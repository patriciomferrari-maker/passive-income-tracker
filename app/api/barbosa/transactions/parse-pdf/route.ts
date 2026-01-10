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
                console.error('[PDF] Error details:', geminiError instanceof Error ? geminiError.message : String(geminiError));
                console.log('[PDF] Falling back to regex parser');
                transactions = parseTextToTransactions(text, rules);
            }
        } else {
            console.log('[PDF] No GEMINI_API_KEY found, using regex parser');
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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest" // Using flash for speed/cost, pro might be better for complex logic
    });

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
        console.log('[PDF] Sliced text length:', processedText.length);
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

    // Use REST API instead of SDK
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    if (!apiResponse.ok) {
        throw new Error(`Gemini API error: ${apiResponse.status}`);
    }
    const result = await apiResponse.json();
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[GEMINI] Raw response:', responseText.substring(0, 500));

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
        throw new Error('Invalid Gemini response format');
    }

    // Post-processing: Filter out invalid transactions
    const invalidKeywords = [
        'total', 'limite', 'tasa', 'saldo', 'pago minimo', 'vencimiento',
        'nominal', 'efectiva', 'cierre', 'periodo', 'consolidado', 'su pago en',
        'nominal', 'efectiva', 'cierre', 'periodo', 'consolidado',
        'pago en pesos', 'pago en dolares', 'pago en usd'
    ];

    const validTransactions = parsed.transactions.filter((tx: any) => {
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

    console.log('[GEMINI] Filtered transactions:', parsed.transactions.length, '→', validTransactions.length);

    // Normalize and validate
    return validTransactions.map((tx: any) => ({
        date: tx.date,
        amount: Math.abs(parseFloat(tx.amount)),
        description: tx.description || 'Sin descripción',
        currency: tx.currency || 'ARS', // Use currency from Gemini (ARS or USD)
        type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        categoryId: tx.categoryId || '',
        subCategoryId: tx.subCategoryId || null,
        comprobante: tx.comprobante || '' // Add comprobante for duplicate detection
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

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. CHECK STOP CONDITION
        // CRITICAL FIX: Only stop if we have ALREADY found transactions. 
        // If we haven't found any, this "Total a Pagar" might be the Header Summary.
        if (stopPhrases.some(phrase => line.toUpperCase().includes(phrase))) {
            if (transactions.length > 0) {
                console.log('[PDF-PARSER] Footer Stop phrase found. Stopping parsing at:', line);
                break;
            } else {
                console.log('[PDF-PARSER] Header Stop phrase ignored (no transactions yet):', line);
            }
        }

        // 2. SKIP NOISE LINES
        if (/saldo|balance|cierre|página|hoja|extracto|resumen|limite|tasa|vencimiento|anterior|TNA|TEA|CFT|IVA RG|DB\.RG|IMPUESTO|PAIS|PERCEPCION/i.test(line)) {
            // console.log('[PDF-PARSER] Skipping noise line:', line);
            continue;
        }

        const dateMatch = line.match(dateRegex);
        const lineForAmount = line.replace(/[U\$S\$]/g, '').trim();
        const amountMatch = lineForAmount.match(amountRegex);

        if (dateMatch) {
            // Found a Date: Potential New Transaction
            currentDate = normalizeDate(dateMatch[0]);

            // Clean the line from the date
            let lineDesc = line.replace(dateMatch[0], '').trim();

            if (amountMatch) {
                // Case A: Date + Amount on same line (Ideal)
                let amountStr = amountMatch[amountMatch.length - 1]; // Take last match usually the column

                // --- COLUMN MERGE FIX (STRATEGY: ENFORCE 6-DIGIT VOUCHER) ---
                // Problem: "007898" (Voucher) + "46.962,55" (Amount) -> Merges to "846.962,55"
                // The parser sees "00789" as text and "846.962,55" as amount.
                // Solution: We assume Voucher is ALWAYS 6 digits (standard).
                // We check how many digits are trailing in the description.

                const matchIndex = lineForAmount.lastIndexOf(amountStr);
                let precedingText = lineForAmount.substring(0, matchIndex).trim();

                // Find trailing digits in preceding text
                const trailingDigitsMatch = precedingText.match(/(\d+)$/);

                if (trailingDigitsMatch) {
                    const trailingDigits = trailingDigitsMatch[1];
                    const trailingCount = trailingDigits.length;

                    if (trailingCount < 6 && trailingCount > 0) {
                        // We are missing some digits to form a 6-digit voucher.
                        // They must have been swallowed by the amount Regex.
                        const needed = 6 - trailingCount;

                        // Check if amountStr starts with enough digits
                        // We strip non-digits to check availability, but for shifting we operate on string.
                        // Actually, amountStr usually starts with digits or minus.
                        if (/^\d/.test(amountStr)) {
                            // Clean check: Can we take 'needed' characters and are they digits?
                            const potentialStolen = amountStr.substring(0, needed);
                            if (/^\d+$/.test(potentialStolen)) {
                                console.log(`[PDF-PARSER] Merge detected. Voucher has ${trailingCount} digits ('${trailingDigits}'). Stealing ${needed} ('${potentialStolen}') from Amount ('${amountStr}').`);

                                // Shift logic
                                // 1. Add stolen to preceding (conceptually, to form voucher)
                                const fullVoucher = trailingDigits + potentialStolen;

                                // 2. Remove stolen from Amount
                                amountStr = amountStr.substring(needed);

                                // 3. Update PrecedingText for description cleaning
                                // We don't really UPDATE precedingText variable for logic, 
                                // but we will use 'fullVoucher' to clean the description later.
                            }
                        }
                    }
                }

                const amount = cleanAmount(amountStr);

                // Clean description
                // 1. Remove the Amount Pattern (We must use the ORIGINAL match to cut it out if we didn't shift?)
                // Actually, replace is risky if duplicated.
                // Safer: Split by Date, take the Right side. Then Remove Amount from Right Side.

                // Let's rely on replace but be careful.
                // If we shifted, 'amountStr' is shorter. replacing it leaves the 'stolen' digits in the text.
                // "00789" + "846..." -> replace "46..." -> "007898" remains.
                // This is perfect.

                finalDesc = lineDesc.replace(amountStr, '').replace(/USD|U\$S|\$/g, '').trim();

                // Aggressive Artifact Removal
                // Remove leading "25K", "K ", etc.
                // "25KMERPAGO" -> "MERPAGO"
                finalDesc = finalDesc.replace(/^[\s\W]*(?:\d{2})?K\s*/, '');

                // Detect Comprobante (Code)
                let comprobante = '';

                // Strategy: Find the 6-digit code at the END of the description (which we likely just reconstructed)
                const compMatchStrict = finalDesc.match(/(\d{6})$/);

                if (compMatchStrict) {
                    comprobante = compMatchStrict[1];
                    finalDesc = finalDesc.replace(comprobante, '').trim();
                } else {
                    // Fallback: 5-10 digits anywhere
                    const compMatchLoose = finalDesc.match(/\b(\d{5,10})\b/);
                    if (compMatchLoose) {
                        comprobante = compMatchLoose[1];
                        finalDesc = finalDesc.replace(comprobante, '').trim();
                    }
                }

                if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                    const isUSD = /USD|U\$S|DOLARES/i.test(line);
                    transactions.push(createTransaction(currentDate, amount, finalDesc, rules, isUSD ? 'USD' : 'ARS', comprobante));
                    currentDescription = [];
                }
            } else {
                // Case B: Date found, but Amount is probably on next line or this is description start
                currentDescription = [lineDesc];
            }
        } else if (amountMatch && currentDate) {
            // Case C: No Date, gives continuation of description + Amount?
            // Usually this happens if description wrapped multiple lines
            const amountStr = amountMatch[amountMatch.length - 1];
            const amount = cleanAmount(amountStr);

            const extraDesc = line.replace(amountStr, '').replace(/USD|U\$S|\$/g, '').trim();
            const fullDesc = [...currentDescription, extraDesc].join(' ').trim();

            let comprobante = '';
            let finalDesc = fullDesc;
            const compMatch = finalDesc.match(/\b(\d{5,10})\b/);
            if (compMatch) {
                comprobante = compMatch[1];
                finalDesc = finalDesc.replace(comprobante, '').trim();
            }

            if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                const isUSD = /USD|U\$S|DOLARES/i.test(line);
                transactions.push(createTransaction(currentDate, amount, finalDesc, rules, isUSD ? 'USD' : 'ARS', comprobante));
                currentDescription = [];
            }
        } else if (currentDate && currentDescription.length > 0 && currentDescription.length < 3) {
            // Case D: Just Description continuation text
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
        // Since regex guarantees a decimal part of 2 digits:
        // Case: 1234.56 -> US.
        // Case: 1.234 (Thousand) -> Regex wouldn't match this as a full amount usually, unless loose?
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
