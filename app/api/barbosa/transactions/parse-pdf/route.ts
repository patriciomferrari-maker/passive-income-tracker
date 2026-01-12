import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import PDFParser from 'pdf2json';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('[PDF] POST requested');
    const userId = await getUserId();

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
        }

        console.log('[PDF] Processing file:', file.name, 'size:', file.size);
        const currentYear = formData.get('currentYear') as string || new Date().getFullYear().toString();
        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Parse PDF using pdf2json (Coordinate Aware)
        console.log('[PDF] Parsing with pdf2json...');
        const rawLines = await parsePdfCoordinates(buffer);
        console.log(`[PDF] Extracted ${rawLines.length} lines.`);

        // 2. Segmentation (Remove Header/Footer Noise)
        const relevantText = segmentText(rawLines);
        console.log(`[PDF] Segmented text length: ${relevantText.length} chars`);

        // 3. Fetch Context (Categories & Rules)
        const [categories, rules] = await Promise.all([
            (prisma as any).barbosaCategory.findMany({ where: { userId }, select: { id: true, name: true, type: true } }),
            (prisma as any).barbosaCategorizationRule.findMany({ where: { userId } })
        ]).catch(err => {
            console.warn('Error fetching context:', err);
            return [[], []];
        });

        let transactions: any[] = [];
        let parserUsed = 'regex';

        if (process.env.GEMINI_API_KEY) {
            try {
                // 4. Gemini AI Parsing
                console.log('[PDF] Attempting Gemini AI parsing...');
                const geminiResult = await parseWithGemini(relevantText, categories, rules, currentYear, file.name);
                transactions = geminiResult.transactions;
                parserUsed = 'gemini';

                // 5. Validation & Correction (Deep Audit)
                console.log('[PDF] Applying Galicia-Enhanced Regex validation...');
                transactions = validateAndCorrectTransactions(transactions, relevantText, currentYear, file.name);
                console.log('[PDF] Validation complete. Count:', transactions.length);

            } catch (geminiError) {
                console.error('[PDF] Gemini parsing failed:', geminiError);
                return NextResponse.json({ error: `Error de IA (Gemini): ${geminiError instanceof Error ? geminiError.message : String(geminiError)}` }, { status: 500 });
            }
        } else {
            console.warn('[PDF] No GEMINI_API_KEY. Using legacy regex parser.');
            // Legacy fallback (simplified for now, ideally we upgrade this too)
            parserUsed = 'regex_fallback';
        }

        // 6. Duplicate Detection
        const existingTransactions = await (prisma as any).barbosaTransaction.findMany({
            where: { userId },
            select: { date: true, amount: true, comprobante: true }
        });

        transactions = transactions.map((tx: any) => {
            let isDuplicate = false;
            // Strong match by Comprobante
            if (tx.comprobante && tx.comprobante.length >= 6) {
                isDuplicate = existingTransactions.some((etx: any) =>
                    etx.comprobante === tx.comprobante && Math.abs(etx.amount - tx.amount) < 1.0
                );
            }
            return { ...tx, isDuplicate, skip: isDuplicate };
        });

        return NextResponse.json({
            text: relevantText.substring(0, 1000), // Snippet
            transactions,
            importSource: `PDF_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
            parserUsed
        });

    } catch (error) {
        console.error('[PDF] Fatal Error:', error);
        return NextResponse.json({ error: 'Error interno al procesar PDF', details: String(error) }, { status: 500 });
    }
}

// ============================================================================
// PDF2JSON COORDINATE PARSER
// ============================================================================

async function parsePdfCoordinates(buffer: Buffer): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const lines: string[] = [];

            // Iterate over pages
            pdfData.Pages.forEach((page: any) => {
                // Group texts by Y coordinate (Line detection)
                const yMap = new Map<number, any[]>();
                const TOLERANCE = 0.5; // Vertical tolerance to group same-line items

                page.Texts.forEach((textItem: any) => {
                    const y = textItem.y;
                    const cleanText = decodeURIComponent(textItem.R[0].T);

                    // Find existing Y group within tolerance
                    let placed = false;
                    for (const existingY of yMap.keys()) {
                        if (Math.abs(existingY - y) < TOLERANCE) {
                            yMap.get(existingY)?.push({ x: textItem.x, text: cleanText });
                            placed = true;
                            break;
                        }
                    }

                    if (!placed) {
                        yMap.set(y, [{ x: textItem.x, text: cleanText }]);
                    }
                });

                // Sort by Y to reconstruct page flow
                const sortedYs = Array.from(yMap.keys()).sort((a, b) => a - b);

                sortedYs.forEach(y => {
                    const items = yMap.get(y);
                    if (items) {
                        // Sort items by X to reconstruct columns left-to-right
                        items.sort((a, b) => a.x - b.x);
                        // Join with space
                        lines.push(items.map(i => i.text).join(' '));
                    }
                });
            });
            resolve(lines);
        });

        pdfParser.parseBuffer(buffer);
    });
}

function segmentText(lines: string[]): string {
    const usefulLines: string[] = [];
    let capture = false;

    // Keywords to start capturing (Galicia & others)
    const START_MARKERS = ['DETALLE DEL CONSUMO', 'FECHA REFERENCIA', 'CONCEPTOS', 'MOVIMIENTOS'];
    // Keywords to stop capturing
    const STOP_MARKERS = ['TOTAL A PAGAR', 'SALDO ACTUAL', 'PAGINA', 'HOJA', 'LIMITES DE COMPRA'];

    for (const line of lines) {
        const upper = line.toUpperCase().trim();

        // Start condition
        if (!capture && START_MARKERS.some(m => upper.includes(m))) {
            capture = true;
            usefulLines.push(line); // Keep header for context if needed
            continue;
        }

        if (capture) {
            // Stop condition
            if (STOP_MARKERS.some(m => upper.includes(m))) {
                // Peek next line to be sure? No, strict cut is safer for noise.
                // usefulLines.push(line); // Maybe optional
                // Don't break completely, might be multi-page with headers in between?
                // For now, let's just keep capturing but filter out the stop-line itself
                // Or if it's "TOTAL A PAGAR", it's likely the end of the summary.
                if (upper.includes('TOTAL A PAGAR') || upper.includes('SALDO ACTUAL')) {
                    break; // End of section
                }
                continue; // Skip footer lines like "PAGINA 1/3"
            }
            usefulLines.push(line);
        }
    }

    // Fallback: If no markers found, return full text (maybe not a Galicia PDF)
    if (usefulLines.length === 0) return lines.join('\n');

    return usefulLines.join('\n');
}


// ============================================================================
// GEMINI PARSER & PROMPTING
// ============================================================================

async function parseWithGemini(text: string, categories: any[], rules: any[], currentYear: string, fileName: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

    // Truncate if too huge
    const processText = text.length > 25000 ? text.substring(0, 25000) : text;

    const categoriesList = categories.map(c => `- ${c.name} (${c.id})`).join('\n');
    const rulesList = rules.map(r => `"${r.pattern}" -> ${r.categoryId}`).join('\n');

    const prompt = `
    Analiza este extracto de resumen bancario (PDF procesado). Tu objetivo es generar un JSON estructurado de transacciones.

    TEXTO INPUT:
    """
    ${processText}
    """

    AÑO CONTEXTO: ${currentYear} (Archivo: ${fileName})
    - Si el resumen es de ENERO 2026, las compras de DICIEMBRE son 2025. Infiere el año correcto.

    COLUMNAS (Típicas en Banco Galicia):
    [FECHA] [DESCRIPCIÓN] [CUOTA opcional] [COMPROBANTE] [IMPORTE]
    
    INSTRUCCIONES CRÍTICAS:
    1. **Fecha**: Formato YYYY-MM-DD.
    2. **Descripción**: Limpia prefijos "K", "*", códigos raros.
    3. **Cuota**: Si ves "01/12", agrégalo a la descripción como " (Cuota 01/12)".
    4. **Comprobante**: 
       - Es un número de 6 dígitos (ej: 004590).
       - NO es el importe. NO tiene decimales.
       - A menudo está ANTES del importe.
    5. **Importe**: 
       - Formato Argentina: 1.000,00 es mil.
       - Si es negativo (devolución/pago), ponlo negativo.

    OUTPUT JSON:
    {
      "transactions": [
        { "date": "2025-12-24", "description": "SUPERMERCADO DIA (Cuota 01/01)", "amount": 15000.50, "comprobante": "001234", "currency": "ARS", "categoryId": "ID_SI_SABES_O_NULL" }
      ]
    }

    CATEGORÍAS (Para ID):
    ${categoriesList}
    REGLAS:
    ${rulesList}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();

    try {
        const parsed = JSON.parse(jsonText);
        return { transactions: parsed.transactions || [], processedText: processText };
    } catch (e) {
        throw new Error("Failed to parse Gemini JSON output");
    }
}

// ============================================================================
// VALIDATION & CORRECTION (GALICIA ENHANCED)
// ============================================================================

function validateAndCorrectTransactions(geminiTransactions: any[], originalText: string, contextYear?: string, fileName?: string): any[] {
    const yearContext = contextYear ? parseInt(contextYear) : new Date().getFullYear();
    // Logic to handle Jan statements referring to Dec previous year
    const isJanuaryStatement = fileName?.toLowerCase().includes('enero') || new Date().getMonth() === 0;

    // GALICIA-OPTIMIZED REGEX "THE AUDITOR"
    // Matches: 
    // 1. Date: dd-mm-yy or dd/mm/yy
    // 2. Desc: Anything in between
    // 3. Cuota (Optional): dd/dd (e.g 01/12)
    // 4. Voucher: STRICT 6 digits boundaries (key for Galicia)
    // 5. Amount: $ 1.000,00 or 1.000,00 (Arg format)

    // Note: pdf2json spaces columns, so we expect spaces.
    // Regex: Start - Date - Space - Desc - Space - [Cuota] - Space - Voucher - Space - Amount - End

    const lines = originalText.split('\n');
    const validTransactions: any[] = [];

    // Map for fuzzy correction
    const auditMap = new Map<string, { date: string, amount: number, voucher: string }>();

    // Scan text to build Audit Map (Truth)
    for (const line of lines) {
        // Regex Breakdown:
        // Date: (\d{2}[-/\.]\d{2}(?:[-/\.]\d{2,4})?)
        // ... space ...
        // Voucher: \b(\d{6})\b (Strict 6 digits)
        // ... space? ...
        // Amount: (?:U\$S|\$)?\s*([0-9\.,-]+) (Capture number, ignore symbol)

        // Strategy: Identifying the "Anchor" columns -> Date and Voucher+Amount at the end.
        const match = line.match(/(\d{2}[-/\.]\d{2}(?:[-/\.]\d{2})?)\s+.*?\s+(?:(\d{2}\/\d{2})\s+)?(\d{6})\s+((?:-)?(?:\d{1,3}\.)*(?:\d{1,3})(?:,\d{2}))/);

        if (match) {
            // Found a clear Galicia row!
            const rawDate = match[1];
            // const rawCuota = match[2]; // Optional
            const rawVoucher = match[3];
            const rawAmount = match[4];

            const parsedDate = normalizeDate(rawDate, yearContext, isJanuaryStatement);
            const parsedAmount = parseArgAmount(rawAmount);

            // Key: Voucher is the best ID
            auditMap.set(rawVoucher, { date: parsedDate, amount: parsedAmount, voucher: rawVoucher });
        }
    }

    return geminiTransactions.map((tx: any) => {
        // 1. Try to find strict match by Voucher
        if (tx.comprobante) {
            const truth = auditMap.get(tx.comprobante);
            if (truth) {
                // FORCE TRUTH
                return {
                    ...tx,
                    date: truth.date,
                    amount: truth.amount, // Override AI amount with Regex extraction
                    grade: 'A+' // Audit Passed
                };
            }
        }

        // 2. Fallback: If no voucher match, keep Gemini's guess but flag it
        return { ...tx, grade: 'B' };
    });
}

function normalizeDate(raw: string, yearContext: number, isJan: boolean): string {
    // Handle formats: 10-08-25, 10/08/25, 12-05
    let [day, month, year] = raw.trim().replace(/[-]/g, '/').split('/').map(Number);

    if (!year) {
        // Inferred year
        // If statement is Jan 2026, and date is Dec -> 2025
        if (isJan && month === 12) year = yearContext - 1;
        else year = yearContext;
    } else if (year < 100) {
        year += 2000;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseArgAmount(raw: string): number {
    // Arg format: 1.000,00 -> 1000.00
    // Remove dots (thousands)
    let clean = raw.replace(/\./g, '');
    // Replace comma with dot
    clean = clean.replace(',', '.');
    return parseFloat(clean);
}
