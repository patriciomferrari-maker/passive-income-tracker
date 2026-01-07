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

        // FORCE REGEX PARSER (Gemini disabled due to hallucinations)
        /*
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
        */
        console.log('[PDF] Using hardened Regex parser');
        transactions = parseTextToTransactions(text, rules);

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

// ... Gemini function remains commented out or unused ...

// ============================================================================
// REGEX-BASED PARSER (HARDENED)
// ============================================================================

function parseTextToTransactions(text: string, rules: any[]) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const transactions: any[] = [];

    // Improved Regex for Date
    // Matches DD/MM/YYYY or DD/MM/YY or DD/MM at start of line or bounded
    const dateRegex = /\b(\d{2}[\/.-]\d{2}(?:[\/.-]\d{2,4})?)\b/g;

    // Improved Regex for Amount
    // Handles: $1.234,56 | 1234.56 | -123.45 | 1.000,00 | USD 100.00
    // Prioritize formats with decimals
    const amountRegex = /(-?(:?USD|U\$S|\$)?\s?[0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b|(-?[0-9]+\.[0-9]{2})\b/g;

    let currentDate: string | null = null;
    let currentDescription: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip noise lines
        if (/saldo|balance|cierre|página|hoja|extracto|resumen|total|límite|tasa/i.test(line)) continue;

        const dateMatch = line.match(dateRegex);
        const amountMatch = line.match(amountRegex);

        if (dateMatch) {
            // New transaction line likely
            currentDate = normalizeDate(dateMatch[0]);

            // Clean the line from the date
            let lineDesc = line.replace(dateMatch[0], '').trim();

            if (amountMatch) {
                // Date and Amount on the same line
                // Pick the last amount (usually the transaction amount, not unit price)
                const amountStr = amountMatch[amountMatch.length - 1];
                const amount = cleanAmount(amountStr);

                // Clean description from amount and currency codes
                const finalDesc = lineDesc.replace(amountStr, '').replace(/USD|U\$S|\$/g, '').trim();

                if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                    // Check currency based on line content
                    const isUSD = /USD|U\$S|DOLARES/i.test(line);

                    transactions.push(createTransaction(currentDate, amount, finalDesc, rules, isUSD ? 'USD' : 'ARS'));
                    currentDescription = [];
                }
            } else {
                // Date found but no amount. Accumulate description.
                currentDescription = [lineDesc];
            }
        } else if (amountMatch && currentDate) {
            // No date, but amount found. Could be continuation or separate line amount.
            const amountStr = amountMatch[amountMatch.length - 1];
            const amount = cleanAmount(amountStr);

            const extraDesc = line.replace(amountStr, '').replace(/USD|U\$S|\$/g, '').trim();
            const finalDesc = [...currentDescription, extraDesc].join(' ').trim();

            if (!isNaN(amount) && Math.abs(amount) > 0.01) {
                const isUSD = /USD|U\$S|DOLARES/i.test(line);
                transactions.push(createTransaction(currentDate, amount, finalDesc, rules, isUSD ? 'USD' : 'ARS'));
                currentDescription = [];
                // Do not reset currentDate, allowing for multiple items under one date? 
                // Actually reset it to avoid attaching random numbers later.
                // currentDate = null; // Maybe safer to reset?
            }
        } else if (currentDate && currentDescription.length < 3) {
            // Accumulate description
            currentDescription.push(line);
        }
    }

    return transactions;
}

function cleanAmount(amountStr: string): number {
    // Remove currency symbols and spaces
    let clean = amountStr.replace(/[U\$S\$\s]/g, '');

    // Check format:
    // 1.234,56 (Arg/Eur) -> remove dots, replace comma with dot
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        // 1234,56
        clean = clean.replace(',', '.');
    }
    // else 1234.56 (US) -> keep as is

    return parseFloat(clean);
}

function createTransaction(date: string, amount: number, description: string, rules: any[], currency: string = 'ARS') {
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
