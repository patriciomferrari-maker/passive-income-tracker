import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/app/lib/auth-helper';
import PDFParser from 'pdf2json';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('[TEST-PDF] Starting test...');

    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        console.log('[TEST-PDF] File received:', file.name, file.size);
        const buffer = Buffer.from(await file.arrayBuffer());
        console.log('[TEST-PDF] Buffer created, size:', buffer.length);

        // Test 1: PDF Parsing
        console.log('[TEST-PDF] Testing pdf2json...');
        const rawLines = await parsePdfCoordinates(buffer);
        console.log('[TEST-PDF] PDF parsed successfully, lines:', rawLines.length);

        // Test 2: Gemini Connection (without actual parsing)
        console.log('[TEST-PDF] Testing Gemini API...');
        const geminiTest = await testGemini();
        console.log('[TEST-PDF] Gemini test result:', geminiTest);

        return NextResponse.json({
            success: true,
            tests: {
                pdfParsing: {
                    status: 'success',
                    lineCount: rawLines.length,
                    sampleLines: rawLines.slice(0, 5)
                },
                geminiConnection: geminiTest
            }
        });

    } catch (error: any) {
        console.error('[TEST-PDF] Error:', error);
        return NextResponse.json({
            success: false,
            error: error?.message || String(error),
            errorType: error?.name,
            stack: error?.stack
        }, { status: 500 });
    }
}

async function parsePdfCoordinates(buffer: Buffer): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const lines: string[] = [];

            pdfData.Pages.forEach((page: any) => {
                const yMap = new Map<number, any[]>();
                const TOLERANCE = 0.5;

                page.Texts.forEach((textItem: any) => {
                    const y = textItem.y;
                    let cleanText = textItem.R[0].T;
                    try {
                        cleanText = decodeURIComponent(textItem.R[0].T);
                    } catch (e) {
                        cleanText = textItem.R[0].T;
                    }

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

                const sortedYs = Array.from(yMap.keys()).sort((a, b) => a - b);

                sortedYs.forEach(y => {
                    const items = yMap.get(y);
                    if (items) {
                        items.sort((a, b) => a.x - b.x);
                        lines.push(items.map(i => i.text).join(' '));
                    }
                });
            });
            resolve(lines);
        });

        pdfParser.parseBuffer(buffer);
    });
}

async function testGemini() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { status: 'error', message: 'GEMINI_API_KEY not found' };
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
        const result = await model.generateContent("Return JSON: {\"test\": \"ok\"}");
        const response = await result.response;

        return {
            status: 'success',
            output: response.text()
        };
    } catch (e: any) {
        return {
            status: 'error',
            message: e?.message,
            type: e?.name
        };
    }
}
