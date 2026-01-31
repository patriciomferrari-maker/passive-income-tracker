
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Check Env Vars availability
        const envCheck = {
            NODE_ENV: process.env.NODE_ENV,
            AUTH_SECRET: process.env.AUTH_SECRET ? 'Set (Length: ' + process.env.AUTH_SECRET.length + ')' : 'MISSING',
            POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? 'Set' : 'MISSING',
            VERCEL_URL: process.env.VERCEL_URL,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set (Length: ' + process.env.GEMINI_API_KEY.length + ')' : 'MISSING',
        };

        // 2. Check DB Connection
        const userCount = await prisma.user.count();
        const dbStatus = {
            connected: true,
            userCount
        };

        // 3. Test Gemini Connection (Simple Prompt)
        let geminiCheck: any = { status: 'skipped' };
        if (process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent("Say 'OK' if you can hear me.");
                const response = await result.response;
                geminiCheck = {
                    status: 'success',
                    output: response.text()
                };
            } catch (e: any) {
                geminiCheck = {
                    status: 'failure',
                    error: e.message,
                    stack: e.stack
                };
            }
        }

        // 4. List Models (Diagnostic)
        let availableModels: any = 'Skipped';
        if (process.env.GEMINI_API_KEY) {
            try {
                const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
                const data = await listRes.json();
                availableModels = data.models ? data.models.map((m: any) => m.name) : data;
            } catch (e: any) {
                availableModels = `Error listing models: ${e.message}`;
            }
        }

        return NextResponse.json({
            status: 'ok',
            env: envCheck,
            db: dbStatus,
            gemini: geminiCheck,
            gemini_models: availableModels,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
