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
                select: { date: true, amount: true, description: true }
            });
        } catch (err) {
            console.warn('[PDF] Could not fetch existing transactions (table or columns might be missing):', err);
        }

        transactions = transactions.map(tx => {
            const isDuplicate = existingTransactions.some(etx =>
                etx.date.toISOString().split('T')[0] === tx.date &&
                Math.abs(etx.amount - tx.amount) < 0.01 &&
                etx.description?.toLowerCase() === tx.description?.toLowerCase()
            );
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
        model: "gemini-1.5-flash-latest"
    });

    // Preprocess text to extract only the transactions section
    let processedText = text;

    // Find the start marker (table header)
    const startMarkers = [
        'FECHA REFERENCIA CUOTA COMPROBANTE PESOS DOLARES',
        'FECHA REFERENCIA CUOTA COMPROBANTE PESOS DÓLARES',
        'FECHA REFERENCIA CUOTA COMPROBANTE PESOS',
        'DETALLE DEL CONSUMO'
    ];

    // Find the end marker (total section)
    const endMarkers = [
        'TOTAL A PAGAR',
        'TARJETA',
        'Total Consumos',
        'Resumen de tarjeta'
    ];

    let startIndex = -1;
    for (const marker of startMarkers) {
        const idx = text.indexOf(marker);
        if (idx !== -1) {
            startIndex = idx + marker.length;
            console.log('[PDF] Found start marker:', marker);
            break;
        }
    }

    let endIndex = text.length;
    for (const marker of endMarkers) {
        const idx = text.indexOf(marker, startIndex);
        if (idx !== -1) {
            endIndex = idx;
            console.log('[PDF] Found end marker:', marker);
            break;
        }
    }

    if (startIndex !== -1) {
        processedText = text.substring(startIndex, endIndex).trim();
        console.log('[PDF] Extracted transaction section. Length:', processedText.length);
    } else {
        console.warn('[PDF] No start marker found, using full text');
    }

    const categoriesText = categories.length > 0
        ? categories.map(c => `- ${c.name} (${c.type}, ID: ${c.id})`).join('\n')
        : 'No hay categorías definidas aún';

    const rulesText = rules.length > 0
        ? rules.map(r => `- Si la descripción contiene "${r.pattern}" → Categoría ID: ${r.categoryId}`).join('\n')
        : 'No hay reglas de categorización definidas';

    const prompt = `Actúa como un extractor de datos profesional para sistemas contables. Tu objetivo es transformar el resumen de tarjeta de crédito en una estructura JSON limpia para ser importada a una base de datos.

RESUMEN DE TARJETA DE CRÉDITO:
${processedText}

CATEGORÍAS DISPONIBLES:
${categoriesText}

REGLAS DE CATEGORIZACIÓN:
${rulesText}

INSTRUCCIONES DE EXTRACCIÓN:

1. **FILTRO DE COMPROBANTE (OBLIGATORIO)**:
   - Extrae el número de COMPROBANTE para cada ítem
   - Este es el identificador único para evitar duplicados
   - Ejemplo: en "16-01-25 VISUAR SA 12/12 008821 84.217,00" → comprobante: "008821"

2. **FECHA**:
   - Formatea como YYYY-MM-DD
   - Si solo tiene DD-MM, asume el año actual (2025)
   - Ejemplo: "16-01-25" → "2025-01-16"

3. **REFERENCIA (DESCRIPCIÓN)**:
   - Incluye el nombre del comercio
   - Si es en cuotas, agrega el número de cuota
   - Ejemplo: "VISUAR SA 12/12" → "VISUAR SA (Cuota 12/12)"

4. **MONEDA Y MONTO**:
   - Formato argentino: PUNTO (.) = separador de miles, COMA (,) = decimal
   - Separa ARS (Pesos) y USD (Dólares)
   - Convierte a número: "84.217,00" → 84217.00
   - Si está en la columna PESOS → currency: "ARS"
   - Si está en la columna DÓLARES → currency: "USD"

5. **ALCANCE**:
   - Revisa TODAS las páginas del documento
   - Captura todos los consumos del apartado 'DETALLE DEL CONSUMO'

6. **EXCLUSIONES (NO EXTRAER)**:
   - SALDO ANTERIOR
   - SU PAGO EN PESOS/USD
   - TOTALES (Total a pagar, Total en pesos)
   - LÍMITES (Límite de compras, Límite de financiación)
   - TASAS (Nominal Anual, Efectiva mensual)
   - PAGO MÍNIMO

7. **CARGOS ADICIONALES (SÍ INCLUIR)**:
   - Percepciones de impuestos (IIBB, IVA)
   - Cargos de mantenimiento (DB.RG)
   - Estos también tienen comprobante

8. **CATEGORIZACIÓN**:
   - Usa las reglas provistas para asignar categoryId
   - Si no hay regla clara, deja categoryId como ""
   - Todos los consumos son type: "EXPENSE"

EJEMPLOS DE EXTRACCIÓN CORRECTA:

✅ "16-01-25 VISUAR SA 12/12 008821 84.217,00"
→ {
  "date": "2025-01-16",
  "comprobante": "008821",
  "description": "VISUAR SA (Cuota 12/12)",
  "amount": 84217.00,
  "currency": "ARS",
  "type": "EXPENSE"
}

✅ "31-12-25 IIBB PERCEP-CABA 2,00%( 1134,90) 22,69"
→ {
  "date": "2025-12-31",
  "comprobante": "",
  "description": "IIBB PERCEP-CABA 2,00%",
  "amount": 22.69,
  "currency": "ARS",
  "type": "EXPENSE"
}

FORMATO DE RESPUESTA (JSON):
{
  "transactions": [
    {
      "date": "2025-01-16",
      "comprobante": "008821",
      "description": "VISUAR SA (Cuota 12/12)",
      "amount": 84217.00,
      "currency": "ARS",
      "type": "EXPENSE",
      "categoryId": "",
      "subCategoryId": null
    }
  ]
}

IMPORTANTE:
- Devuelve SOLO el JSON válido, sin texto adicional
- NO omitas ningún consumo de ninguna página
- Asegúrate de extraer el comprobante cuando esté disponible
- Si no encuentras transacciones, devuelve {"transactions": []}`;

    // Use REST API instead of SDK
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
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
    const responseText = result.candidates[0].content.parts[0].text;

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
        'nominal', 'efectiva', 'cierre', 'periodo', 'consolidado'
    ];

    const validTransactions = parsed.transactions.filter((tx: any) => {
        const desc = (tx.description || '').toLowerCase();
        const amount = parseFloat(tx.amount);

        // Filter out if description contains invalid keywords
        if (invalidKeywords.some(keyword => desc.includes(keyword))) {
            console.log('[GEMINI] Filtered out (invalid keyword):', desc);
            return false;
        }

        // Filter out if amount is unreasonably high (likely a limit or total)
        if (amount > 1000000) {
            console.log('[GEMINI] Filtered out (amount too high):', amount);
            return false;
        }

        // Filter out if description is too short or just numbers
        if (desc.length < 3 || /^[\d\s.,]+$/.test(desc)) {
            console.log('[GEMINI] Filtered out (invalid description):', desc);
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

    // Improved Regex for Date (DD/MM/YYYY, DD/MM/YY, DD/MM)
    const dateRegex = /(\d{2}[\/.-]\d{2}[\/.-]\d{2,4})|(\d{2}[\/.-]\d{2})/g;

    // Improved Regex for Amount
    // Handles: 1.234,56 | 1234.56 | -123.45 | $ 1.000,00
    // We look for numbers with at least 2 decimal places or typical currency formats
    const amountRegex = /(-?\$?\s?[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})|(-?[0-9]+\.[0-9]{2})/g;

    let currentDate: string | null = null;
    let currentDescription: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip noise lines
        if (/saldo|balance|cierre|página|hoja|extracto|resumen/i.test(line)) continue;

        const dateMatch = line.match(dateRegex);
        const amountMatch = line.match(amountRegex);

        if (dateMatch) {
            // If we found a new date, but had an accumulated description/amount? 
            // Most likely a new transaction starts here.
            currentDate = normalizeDate(dateMatch[0]);

            // Clean the line from the date to get more description
            let lineDesc = line.replace(dateMatch[0], '').trim();

            if (amountMatch) {
                // Happy path: Date and Amount on the same line
                const amountStr = amountMatch[amountMatch.length - 1]; // Usually the last one is the transaction amount
                const amount = cleanAmount(amountStr);

                const finalDesc = lineDesc.replace(amountStr, '').trim();

                if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                    transactions.push(createTransaction(currentDate, amount, finalDesc, rules));
                    // Reset but keep date if next line also has amount
                    currentDescription = [];
                }
            } else {
                // Date found but no amount. Accumulate description.
                currentDescription = [lineDesc];
            }
        } else if (amountMatch && currentDate) {
            // No date on this line, but we have a pending date and an amount
            const amountStr = amountMatch[amountMatch.length - 1];
            const amount = cleanAmount(amountStr);

            // The line might contain the rest of the description
            const extraDesc = line.replace(amountStr, '').trim();
            const finalDesc = [...currentDescription, extraDesc].join(' ').trim();

            if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                transactions.push(createTransaction(currentDate, amount, finalDesc, rules));
                currentDescription = [];
                // We don't reset currentDate yet, as multiple amounts might follow one date (rare but possible)
            }
        } else if (currentDate && currentDescription.length < 3) {
            // Just a middle line with more description
            currentDescription.push(line);
        }
    }

    return transactions;
}

function cleanAmount(amountStr: string): number {
    return parseFloat(amountStr.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.'));
}

function createTransaction(date: string, amount: number, description: string, rules: any[]) {
    // Determine type: usually negative in statements or specific signs
    // Heuristic: Positive amounts are usually expenses in summaries, 
    // but in raw statements debt is often positive.
    // For now, keep as EXPENSE unless we find "DEPOSITO" or similar.
    let type = 'EXPENSE';
    let finalAmount = Math.abs(amount);

    if (/deposito|acreditacion|transferencia recibida|devolucion/i.test(description)) {
        type = 'INCOME';
    }

    // Smart Categorization
    let categoryId = '';
    let subCategoryId = null;

    const matchingRule = rules.find(rule =>
        description.toLowerCase().includes(rule.pattern.toLowerCase())
    );

    if (matchingRule) {
        categoryId = matchingRule.categoryId;
        subCategoryId = matchingRule.subCategoryId;
    }

    return {
        date,
        amount: finalAmount,
        description: description || 'Sin descripción',
        currency: 'ARS',
        type,
        categoryId,
        subCategoryId
    };
}

function normalizeDate(dateStr: string) {
    const parts = dateStr.split(/[\/.-]/);
    const today = new Date();
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    let year = parts[2] ? parseInt(parts[2]) : today.getFullYear();

    if (year < 100) year += 2000;
    if (year < 1000) year = today.getFullYear(); // Fallback for weird extra numbers

    const date = new Date(year, month, day);
    // Validate date
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];

    return date.toISOString().split('T')[0];
}
