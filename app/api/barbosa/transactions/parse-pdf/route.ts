import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Polyfill for browser globals expected by some PDF libraries even on the server
if (typeof global.DOMMatrix === 'undefined') (global as any).DOMMatrix = class DOMMatrix { };
if (typeof global.ImageData === 'undefined') (global as any).ImageData = class ImageData { };
if (typeof global.Path2D === 'undefined') (global as any).Path2D = class Path2D { };

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('[PDF] POST requested');
    const userId = await getUserId();

    if (!userId) {
        console.warn('[PDF] Unauthorized - No userId returned from getUserId()');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[PDF] Authorized for user:', userId);

    // Use require for pdf-parse (v1.1.1) lib directly to avoid side-effects in index.js
    // Moving it inside the handler to avoid top-level ReferenceErrors during build
    console.log('[PDF] Initializing pdf-parse v1.1.1 (direct lib)...');
    let pdf;
    try {
        // We require the internal file to avoid a side-effect in index.js that tries to load a test PDF
        pdf = require('pdf-parse/lib/pdf-parse.js');
    } catch (importError) {
        console.error('[PDF] Failed to load pdf-parse:', importError);
        return NextResponse.json({ error: 'Servidor no tiene instalado pdf-parse' }, { status: 500 });
    }

    try {
        console.log('[PDF] Fetching formData...');
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            console.error('[PDF] No file found in request');
            return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
        }

        console.log('[PDF] Processing file:', file.name, 'size:', file.size);
        const buffer = Buffer.from(await file.arrayBuffer());

        console.log('[PDF] Calling pdf-parse...');
        const data = await pdf(buffer);

        console.log('[PDF] Parse complete. Text length:', data.text?.length);
        const text = data.text;

        if (!text) {
            console.warn('[PDF] Parse succeeded but returned no text');
            return NextResponse.json({ error: 'No se pudo extraer texto del PDF' }, { status: 400 });
        }

        // Fetch categories for smart categorization
        let categories: any[] = [];
        try {
            categories = await (prisma as any).barbosaCategory.findMany({
                where: { userId },
                select: { id: true, name: true, type: true }
            });
        } catch (err) {
            console.warn('[PDF] Could not fetch categories:', err);
        }

        // Fetch rules for smart categorization - Resilient to missing tables
        let rules: any[] = [];
        try {
            rules = await (prisma as any).barbosaCategorizationRule.findMany({
                where: { userId }
            });
        } catch (err) {
            console.warn('[PDF] Could not fetch categorization rules (table might not exist yet):', err);
        }

        // Try Gemini AI parser first, fall back to regex if unavailable
        let transactions: any[] = [];
        let parserUsed = 'regex';

        if (process.env.GEMINI_API_KEY) {
            try {
                console.log('[PDF] Attempting Gemini AI parsing...');
                // Pass text but we will slice it inside the function
                transactions = await parseWithGemini(text, categories, rules);
                parserUsed = 'gemini';
                console.log('[PDF] Gemini parsing successful. Detected', transactions.length, 'transactions');
            } catch (geminiError) {
                console.error('[PDF] Gemini parsing failed:', geminiError);
                const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
                console.error('[PDF] Error details:', msg);

                // DEBUG STRATEGY: Fail loudly if Gemini fails, so user knows 'Why'.
                // Do NOT fallback to regex if user specifically wants Gemini.
                return NextResponse.json({ error: `Error de IA (Gemini): ${msg}` }, { status: 500 });
            }
        } else {
            console.warn('[PDF] No GEMINI_API_KEY env var found. Using fallback Regex parser.');
            transactions = parseTextToTransactions(text, rules);
        }

        // Duplicate Detection - Resilient to missing tables or columns
        let existingTransactions: any[] = [];
        try {
            existingTransactions = await (prisma as any).barbosaTransaction.findMany({
                where: { userId },
                select: { date: true, amount: true, description: true, comprobante: true }
            });
        } catch (err) {
            console.warn('[PDF] Could not fetch existing transactions (table or columns might be missing):', err);
        }

        transactions = transactions.map(tx => {
            let isDuplicate = false;

            // Check by Comprobante first (Strongest check)
            if (tx.comprobante && tx.comprobante.length > 2) {
                isDuplicate = existingTransactions.some(etx =>
                    etx.comprobante === tx.comprobante &&
                    // Amount check just in case same comprobante is reused? Unlikely, but safety.
                    // Actually, keep it strict to avoid false positives if comprobante is short
                    Math.abs(etx.amount - tx.amount) < 0.1
                );
            }

            // Fallback to fuzzy match logic if not found by comprobante
            if (!isDuplicate) {
                isDuplicate = existingTransactions.some(etx =>
                    etx.date.toISOString().split('T')[0] === tx.date &&
                    Math.abs(etx.amount - tx.amount) < 0.01 &&
                    etx.description?.toLowerCase() === tx.description?.toLowerCase()
                );
            }

            return { ...tx, isDuplicate, skip: isDuplicate };
        });

        return NextResponse.json({
            text: text.substring(0, 1000), // Return snippet for debug
            transactions,
            importSource: `PDF_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
            parserUsed // 'gemini' or 'regex'
        });

    } catch (error) {
        console.error('[PDF] Fatal Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        return NextResponse.json({
            error: 'Error interno al procesar PDF',
            details: errorMessage,
            stack: errorStack
        }, { status: 500 });
    }
}

// ============================================================================
// GEMINI AI PARSER
// ============================================================================

async function parseWithGemini(text: string, categories: any[], rules: any[]) {
    // 1. Initialize SDK
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    console.log('[GEMINI] Initializing with Key prefix:', apiKey.substring(0, 5) + '...');

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use specific version 001 to avoid "Not Found" 404 on alias
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

    // CRITICAL: Preprocess text to extract only the transactions section.
    // The user specifically requested to start from "DETALLE DEL CONSUMO"
    let processedText = text;

    // Find the start marker (table header)
    // We split by lines to find the header line more reliably
    const lines = text.split('\n');
    let startLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toUpperCase().replace(/\s+/g, ' '); // Normalize spaces
        if (line.includes('DETALLE DEL CONSUMO') || line.includes('FECHA REFERENCIA CUOTA')) {
            startLineIndex = i;
            console.log('[PDF] Found start line:', line);
            break;
        }
    }

    if (startLineIndex !== -1) {
        // Find end marker (TOTAL, LIMITES) starting from startLineIndex
        let endLineIndex = lines.length;
        for (let i = startLineIndex + 1; i < lines.length; i++) {
            const line = lines[i].toUpperCase();
            if (line.includes('TOTAL A PAGAR') ||
                line.includes('SALDO ACTUAL') ||
                line.includes('LIMITES DE COMPRA') ||
                line.includes('LÍMITES DE COMPRA')) {
                endLineIndex = i;
                console.log('[PDF] Found end line:', line);
                break;
            }
        }
        // Reconstruct text only from the relevant lines
        processedText = lines.slice(startLineIndex, endLineIndex).join('\n');
    } else {
        console.warn('[PDF] Header "DETALLE DEL CONSUMO" not found. Using simple text search fallback.');
        const idx = text.toUpperCase().indexOf('DETALLE DEL CONSUMO');
        if (idx !== -1) {
            processedText = text.substring(idx);
        }
        // Otherwise use full text (fallback)
    }

    // Limit context size if too huge
    if (processedText.length > 20000) processedText = processedText.substring(0, 20000);

    const categoriesText = categories.length > 0
        ? categories.map(c => `- ${c.name} (${c.type}, ID: ${c.id})`).join('\n')
        : 'No hay categorías definidas aún';

    const rulesText = rules.length > 0
        ? rules.map(r => `- Si la descripción contiene "${r.pattern}" → Categoría ID: ${r.categoryId}`).join('\n')
        : 'No hay reglas de categorización definidas';

    const prompt = `Actúa como un experto en análisis de datos contables. Tu tarea es extraer los movimientos del resumen de tarjeta de crédito adjunto y organizarlos en una tabla estructurada (JSON).
    
TEXTO A ANALIZAR:
"""
${processedText}
"""

CATEGORÍAS DISPONIBLES (Para pre-clasificación):
${categoriesText}

REGLAS DE CATEGORIZACIÓN (Prioridad Alta):
${rulesText}

Instrucciones de extracción:

1. **Fecha**: Extrae la fecha en formato YYYY-MM-DD. Infiere el año correctamente (si el resumen es de enero, los consumos de diciembre son del año anterior).
   
2. **Referencia/Establecimiento**: Limpia el nombre eliminando códigos internos innecesarios (ej. si dice 'K MERPAGO', dejar 'Mercado Pago' o el nombre del comercio). Elimina prefijos 'K ' solitos.

3. **Cuota**: Identifica si el gasto es en cuotas (ej. '02/03'). Si lo encuentras, agrégalo al final de la descripción como " (Cuota 02/03)".
   
4. **Comprobante**: Extrae el número de operación o comprobante de 6-10 dígitos si existe.

5. **Importe**: Separa los montos en Pesos (ARS) y Dólares (USD). 
   - **IMPORTANTE**: Identifica signos negativos (-). Si es negativo, el monto debe ser negativo en el JSON.
   - Detecta si el monto es en ARS (columna $) o USD (columna USD).

6. **Impuestos y Tasas**: Si encuentras líneas que corresponden a 'IVA', 'Impuesto PAIS', 'Percepción', 'DB.RG', agrúpalas. (Opcional: puedes ignorarlas si son mero ruido, pero si son cargos reales, expórtalos).

SALIDA ESPERADA (Strict JSON format inside transactions array):
{
  "transactions": [
    {
      "date": "2025-11-08",
      "description": "PORTSAID (Cuota 02/03)",
      "amount": 19933.33,
      "currency": "ARS",
      "type": "EXPENSE",
      "categoryId": "ID_SI_APLICA",
      "subCategoryId": null,
      "comprobante": "002750"
    }
  ]
}

REGLA ESPECIAL: Si falta algún dato de una fila o la línea es basura ("SALDO ANTERIOR", "PAGO EN PESOS"), IGNORA LA FILA. No inventes datos.`;

    // USE SDK GENERATE CONTENT
    console.log('[GEMINI] Sending prompt to SDK...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log('[GEMINI] Raw response length:', responseText.length);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(jsonText.trim());

    if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
        throw new Error('Invalid Gemini response format (missing transactions array)');
    }

    // ... rest of validation logic ...
    return validateAndFilterTransactions(parsed.transactions);
}

function validateAndFilterTransactions(rawTransactions: any[]) {
    const invalidKeywords = [
        'total', 'limite', 'tasa', 'saldo', 'pago minimo', 'vencimiento',
        'nominal', 'efectiva', 'cierre', 'periodo', 'consolidado', 'su pago en',
        'nominal', 'efectiva', 'cierre', 'periodo', 'consolidado',
        'pago en pesos', 'pago en dolares', 'pago en usd'
    ];

    const validTransactions = rawTransactions.filter((tx: any) => {
        const desc = (tx.description || '').toLowerCase();
        const descNormalized = desc.replace(/\s+/g, ' '); // Normalize double spaces

        // Filter out if description contains invalid keywords
        if (invalidKeywords.some(keyword => descNormalized.includes(keyword))) {
            console.log('[GEMINI] Filtered out (invalid keyword):', desc);
            return false;
        }

        // Filter out exact match "SU PAGO EN PESOS" etc using normalized string
        if (descNormalized.includes('su pago en')) {
            console.log('[GEMINI] Filtered out (payment text):', desc);
            return false;
        }

        const amount = parseFloat(tx.amount);
        // Filter out if amount is unreasonably high (likely a limit or total)
        if (amount > 10000000) {
            console.log('[GEMINI] Filtered out (amount too high):', amount);
            return false;
        }

        return true;
    });

    console.log('[GEMINI] Filtered transactions:', rawTransactions.length, '→', validTransactions.length);

    // Normalize and validate
    return validTransactions.map((tx: any) => ({
        date: tx.date,
        amount: Math.abs(parseFloat(tx.amount)),
        description: tx.description || 'Sin descripción',
        currency: tx.currency || 'ARS',
        type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        categoryId: tx.categoryId || '',
        subCategoryId: tx.subCategoryId || null,
        comprobante: tx.comprobante || ''
    }));
}

// ============================================================================
// REGEX-BASED PARSER (FALLBACK)
// ============================================================================

function parseTextToTransactions(text: string, rules: any[]) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const transactions: any[] = [];

    // Improved Regex for Date
    // Matches DD/MM/YYYY or DD/MM/YY or DD/MM at start of line or bounded
    const dateRegex = /\b(\d{2}[\/.-]\d{2}(?:[\/.-]\d{2,4})?)\b/g;

    // Improved Regex for Amount
    // Handles:
    // Arg/Eur: 1.234,56 | 1234,56 | -1.234,56
    // US: 1,234.56 | 1234.56 | -1,234.56
    // Matches numbers with exactly 2 decimal places to minimize false positives
    // Group 1: Arg format (dots as thousands, comma decimal)
    // Group 2: US format (commas as thousands, dot decimal)
    // Negative lookahead (?!\s*%) prevents matching percentages like "94,59%"
    const amountRegex = /(-?(?:[0-9]{1,3}(?:\.[0-9]{3})*),[0-9]{2})(?!\s*%)|(-?(?:[0-9]{1,3}(?:,[0-9]{3})*)\.[0-9]{2})(?!\s*%)/g;

    let currentDate: string | null = null;
    let currentDescription: string[] = [];

    // STOP CONDITION: If we see these, we likely reached the footer
    const stopPhrases = ['TOTAL A PAGAR', 'SU PAGO EN PESOS', 'SU PAGO EN DOLARES', 'SALDO ACTUAL'];

    // --- STRATEGY 1: MASTER REGEX (Structure Based) ---
    // Matches: Date + Spaces + Description + (Optional Cuota) + Voucher(6) + (Optional Space) + Amount
    // 1. Date: DD/MM/YY or DD-MM-YY
    // 2. Description: Text (lazy)
    // 3. Cuota: Optional NN/NN or NN/N pattern (e.g. 01/06 or 01/6)
    // 4. Voucher: STRICT 6 digits. (Using \s* before and after to handle merged columns)
    // 5. Amount: Final number
    const masterRegex = /^(\d{2}[\/.-]\d{2}(?:[\/.-]\d{2,4})?)\s+(.*?)(?:\s+(\d{2}\/\d{1,2}))?\s+(\d{6})\s*([0-9.,-]+)$/i;
    // Note on \s+: We enforce at least one space between date and desc, and desc and voucher? 
    // Actually, merged columns might mean NO space between Desc and Voucher? 
    // "MERPAGO*KM001234" -> Voucher 001234? No, usually text is separate.
    // The previous issue was Voucher+Amount merge. "001234" + "100.00" -> "001234100.00"
    // So \s* between Group 4 (Voucher) and Group 5 (Amount) is the key.

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. SKIP NOISE (& Header summaries if no tx found yet check removed for simplicity, assuming regex is specific enough)
        // Added: SU PAGO, PAGO EN, TOTAL CONSUMOS, TARJETA (summary line), SALDO
        if (/saldo|balance|cierre|página|hoja|extracto|resumen|limite|tasa|vencimiento|anterior|TNA|TEA|CFT|IVA RG|DB\.RG|IMPUESTO|PAIS|PERCEPCION|TOTAL CONSUMOS|SU PAGO|PAGO EN|TARJETA/i.test(line)) continue;

        // STOP check (Footer)
        if (stopPhrases.some(phrase => line.toUpperCase().includes(phrase))) {
            if (transactions.length > 0) break;
        }

        // 2. TRY MASTER REGEX FIRST (Specific Structure)
        const masterMatch = line.trim().match(masterRegex);

        if (masterMatch) {
            console.log('[PDF-PARSER] Master Regex Match:', line);
            const rawDate = masterMatch[1];
            let description = masterMatch[2].trim();
            const cuota = masterMatch[3]; // undefined if not found
            const voucher = masterMatch[4];
            let amountStr = masterMatch[5];

            // Validation: Amount looks like a number?
            if (/[\d.,]+/.test(amountStr)) {
                const currentDate = normalizeDate(rawDate);
                const amount = cleanAmount(amountStr);

                // Add Cuota to description if exists AND is valid (not 01/0 artifact)
                if (cuota && !cuota.endsWith('/0')) {
                    description += ` (Cuota ${cuota})`;
                }

                // Clean artifacts from description
                description = description.replace(/^[\s\W]*(?:\d{2})?K\s*/, '').replace(/USD|U\$S|\$/g, '').replace(/\b\d{2}\/0\b/g, '').trim();

                const isUSD = /USD|U\$S|DOLARES/i.test(line);
                transactions.push(createTransaction(currentDate, amount, description, rules, isUSD ? 'USD' : 'ARS', voucher));
                continue; // Done with this line!
            }
        }

        // 3. STRATEGY 2: COMPONENT EXTRACTION (Outside-In)
        // If Master Regex failed, let's try to peel off the known parts from edges.
        // Format: DATE .......... [Cuota] [Voucher] AMOUNT

        const trimmedLine = line.trim();
        // A. Extract Date (Start)
        const dateMatch = trimmedLine.match(/^(\d{2}[\/.-]\d{2}(?:[\/.-]\d{2,4})?)/);

        // B. Extract Amount (End)
        // We look for the last number-like thing.
        const amountMatch = trimmedLine.match(/([0-9.,-]+)$/);

        if (dateMatch && amountMatch) {
            const rawDate = dateMatch[1];
            let amountStr = amountMatch[1];
            let middleText = trimmedLine.substring(rawDate.length, trimmedLine.length - amountStr.length).trim();

            // C. Extract Voucher (6 Digits at the end of middle text)
            // We look for 6 digits at the very end of the middle text.
            let voucher = '';
            const voucherMatch = middleText.match(/(\d{6})\s*$/);

            if (voucherMatch) {
                voucher = voucherMatch[1];
                middleText = middleText.substring(0, middleText.length - voucherMatch[0].length).trim();
            } else {
                // Try looking for "Glued" voucher in the amountStr?
                // "001234100.00" -> Amount "100.00", Voucher "001234"
                // If the amount regex captured the voucher, 'amountStr' would be long.
                // But our amount regex `[0-9.,-]+$` is greedy? No, it's specific characters.
                // If amountStr is "001234100.00", it looks like a number.
                // Let's check fallback if we didn't find voucher in middle.
                if (amountStr.length > 8 && /^\d{6}/.test(amountStr)) {
                    // Likely glued.
                    voucher = amountStr.substring(0, 6);
                    amountStr = amountStr.substring(6);
                    console.log(`[PDF-PARSER] Strategy 2: Split Glued Voucher '${voucher}' from Amount.`);
                }
            }

            // D. Extract Cuota (End of remaining middle text)
            // Look for pattern NN/NN or NN/N
            let cuota = '';
            const cuotaMatch = middleText.match(/(\d{2}\/\d{1,2})\s*$/);
            if (cuotaMatch) {
                const potentialCuota = cuotaMatch[1];
                if (!potentialCuota.endsWith('/0')) {
                    cuota = potentialCuota;
                    middleText = middleText + ` (Cuota ${cuota})`; // Append cleanly
                }
                // Remove from description text regardless of validity (clean artifact)
                middleText = middleText.substring(0, middleText.length - cuotaMatch[0].length).trim();
            }

            // E. Finalize
            const currentDate = normalizeDate(rawDate);
            const amount = cleanAmount(amountStr);
            let description = middleText;

            // Clean artifacts
            description = description.replace(/^[\s\W]*(?:\d{2})?K\s*/, '').replace(/USD|U\$S|\$/g, '').replace(/\b\d{2}\/0\b/g, '').trim();

            const isUSD = /USD|U\$S|DOLARES/i.test(line);
            transactions.push(createTransaction(currentDate, amount, description, rules, isUSD ? 'USD' : 'ARS', voucher));
            continue; // Done!
        }

        // 4. FALLBACK: OLD CHUNK LOGIC (Last Resort)
        // Only if both strategies failed.

        const chunkDateMatch = line.match(dateRegex);
        // ... (We can keep or remove the old logic. Let's keep it minimal for very weird lines)
        const lineForAmount = line.replace(/[U\$S\$]/g, '').trim();
        // Check for "Glued" Voucher + Amount scenario (User priority: Isolate Voucher First)
        // Pattern: 6 digits (Voucher) immediately followed by a valid Amount
        // ARS: 1.234,56
        // USD: 1,234.56
        const gluedArsRegex = /(\d{6})(-?(?:[0-9]{1,3}(?:\.[0-9]{3})*),[0-9]{2})(?!\s*%)/;
        const gluedUsdRegex = /(\d{6})(-?(?:[0-9]{1,3}(?:,[0-9]{3})*)\.[0-9]{2})(?!\s*%)/;

        let gluedMatch = lineForAmount.match(gluedArsRegex) || lineForAmount.match(gluedUsdRegex);

        let amountStr = '';
        let explicitVoucher = '';

        if (gluedMatch) {
            // We found a stuck voucher!
            explicitVoucher = gluedMatch[1];
            amountStr = gluedMatch[2];
            console.log(`[PDF-PARSER] Found GLUED Voucher '${explicitVoucher}' + Amount '${amountStr}'`);
        } else {
            // Standard Amount Search
            const amountMatch = lineForAmount.match(amountRegex);
            if (amountMatch) {
                amountStr = amountMatch[amountMatch.length - 1];

                // --- FALLBACK SHIFTING LOGIC (just in case) ---
                // If simple regex found it, we check if it stole prefix digits.
                // "00789" + "846..."
                const matchIndex = lineForAmount.lastIndexOf(amountStr);
                let precedingText = lineForAmount.substring(0, matchIndex).trim();
                const trailingDigitsMatch = precedingText.match(/(\d+)$/);

                if (trailingDigitsMatch && /^\d/.test(amountStr)) {
                    const trailingDigits = trailingDigitsMatch[1];
                    const trailingCount = trailingDigits.length;
                    if (trailingCount < 6 && trailingCount > 0) {
                        const needed = 6 - trailingCount;
                        const potentialStolen = amountStr.substring(0, needed);
                        if (/^\d+$/.test(potentialStolen)) {
                            console.log(`[PDF-PARSER] Merge detected (Fallback). Shifting '${potentialStolen}' back.`);
                            explicitVoucher = trailingDigits + potentialStolen;
                            amountStr = amountStr.substring(needed);
                        }
                    }
                }
            }
        }

        if (dateMatch) {
            // Found a Date: Potential New Transaction
            currentDate = normalizeDate(dateMatch[0]);

            // Clean the line from the date
            let lineDesc = line.replace(dateMatch[0], '').trim();

            if (amountStr) {
                // Case A: Date + Amount found
                const amount = cleanAmount(amountStr);

                // Clean description
                // If explicitVoucher found, we need to remove it explicitly from description too if it was there
                // The amountStr replacement handles the amount.
                // But the MERGED string "007898846..." -> amountStr is "46..."
                // replacing "46..." leaves "007898".
                // Good.

                let finalDesc = lineDesc.replace(amountStr, '').replace(/USD|U\$S|\$/g, '').trim();

                // If we identified a voucher, remove it from description to keep it clean? 
                // Usually user wants name only.
                if (explicitVoucher) {
                    finalDesc = finalDesc.replace(explicitVoucher, '').trim();
                }

                // Aggressive Artifact Removal
                finalDesc = finalDesc.replace(/^[\s\W]*(?:\d{2})?K\s*/, '');

                // Detect Comprobante (Code) - Use Explicit if found, else Search
                let comprobante = explicitVoucher;

                if (!comprobante) {
                    const compMatchStrict = finalDesc.match(/(\d{6})$/);
                    if (compMatchStrict) {
                        comprobante = compMatchStrict[1];
                        finalDesc = finalDesc.replace(comprobante, '').trim();
                    } else {
                        const compMatchLoose = finalDesc.match(/\b(\d{5,10})\b/);
                        if (compMatchLoose) {
                            comprobante = compMatchLoose[1];
                            finalDesc = finalDesc.replace(comprobante, '').trim();
                        }
                    }
                }

                if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                    const isUSD = /USD|U\$S|DOLARES/i.test(line);
                    transactions.push(createTransaction(currentDate, amount, finalDesc, rules, isUSD ? 'USD' : 'ARS', comprobante));
                    currentDescription = [];
                }
            } else {
                // Case B: Date found, but Amount is probably on next line
                currentDescription = [lineDesc];
            }
        } else if (amountStr && currentDate) {
            // Case C: Continuation amount
            const amount = cleanAmount(amountStr);
            const extraDesc = line.replace(amountStr, '').replace(/USD|U\$S|\$/g, '').trim();

            // ... Logic for cleaning description and voucher similar to above ...
            // For brevity, we assume minimal merge issues in Case C (usually multiline descriptions separate well)
            // But we should apply the same cleaning.

            let fullDesc = [...currentDescription, extraDesc].join(' ').trim();
            if (explicitVoucher) { // If glued logic worked here too
                fullDesc = fullDesc.replace(explicitVoucher, '').trim();
            }

            let comprobante = explicitVoucher;
            if (!comprobante) {
                const compMatch = fullDesc.match(/\b(\d{6})\b/); // Simplified check for C
                if (compMatch) {
                    comprobante = compMatch[1];
                    fullDesc = fullDesc.replace(comprobante, '').trim();
                }
            }

            if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                const isUSD = /USD|U\$S|DOLARES/i.test(line);
                transactions.push(createTransaction(currentDate, amount, fullDesc, rules, isUSD ? 'USD' : 'ARS', comprobante));
                currentDescription = [];
            }
        } else if (currentDate && currentDescription.length > 0 && currentDescription.length < 3) {
            // Case D output...
            if (currentDescription.length > 0) currentDescription.push(line);
        }
    }

    console.log(`[PDF-PARSER] Parse complete. Found ${transactions.length} transactions.`);
    return transactions;
}

function cleanAmount(amountStr: string): number {
    let clean = amountStr.replace(/[U\$S\$\s]/g, '');

    // Determine format by checking positions of separators
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');

    if (lastDot > -1 && lastComma > -1) {
        if (lastDot > lastComma) {
            // 1,234.56 (US Format: Comma thousand, Dot decimal)
            clean = clean.replace(/,/g, '');
        } else {
            // 1.234,56 (Arg Format: Dot thousand, Comma decimal)
            clean = clean.replace(/\./g, '').replace(',', '.');
        }
    } else if (lastComma > -1) {
        // Has comma, no dot. 
        // If it looks like 1234,56 -> Arg
        clean = clean.replace(',', '.');
    } else if (lastDot > -1) {
        // Has dot, no comma.
        // If it looks like 1234.56 -> US
        // If it looks like 1.234 (no decimal part matched by regex? regex requires .XX)
        // Our regex requires `\.[0-9]{2}` for the dot group.
        // So 1.234 would ONLY match if it was 1.23 (value ~1).
        // Safest assumption with dot is standard float.
    }

    return parseFloat(clean);
}

function createTransaction(date: string, amount: number, description: string, rules: any[], currency: string = 'ARS', comprobante: string = '') {
    let type = 'EXPENSE';
    let finalAmount = Math.abs(amount);

    if (/deposito|acreditacion|transferencia recibida|devolucion|pago/i.test(description)) {
        // Sometimes "Pago" is a Payment TO the card (Income to card balance?) 
        // or a Payment OF the card. Context matters.
        // For credit card statements, usually payments are credits (Income logic).
        // Let's assume typical expenses are just expenses.
    }

    let categoryId = '';
    let subCategoryId = null;

    const matchingRule = rules.find(rule =>
        description.toLowerCase().includes(rule.pattern.toLowerCase())
    );

    if (matchingRule) {
        categoryId = matchingRule.categoryId;
        subCategoryId = matchingRule.subCategoryId;
    }

    // Clean description junk
    const cleanDesc = description.replace(/\s+/g, ' ').replace(/^\W+/, '').substring(0, 100);

    return {
        date,
        amount: finalAmount,
        description: cleanDesc || 'Sin descripción',
        currency,
        type,
        categoryId,
        subCategoryId,
        comprobante: comprobante || null
    };
}

function normalizeDate(dateStr: string) {
    const parts = dateStr.split(/[\/.-]/);
    const today = new Date();
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    let year = parts[2] ? parseInt(parts[2]) : today.getFullYear();

    if (year < 100) year += 2000;

    // Sanity Check: If year is way in the future (e.g. > current + 1), it's likely a parsing error
    if (year > today.getFullYear() + 1) {
        year = today.getFullYear();
    }
    // If year is too old (< 2000), fix it
    if (year < 2000) year = today.getFullYear();

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];

    return date.toISOString().split('T')[0];
}
