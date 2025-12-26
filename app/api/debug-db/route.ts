import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Query to check database name
        const dbNameInfo = await prisma.$queryRaw`SELECT current_database();`;

        // Query to check columns in Property table
        const propertyColumns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Property';
        `;

        // Query to check columns in Debt table
        const debtColumns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Debt';
        `;

        return NextResponse.json({
            database: dbNameInfo,
            columns: {
                Property: propertyColumns,
                Debt: debtColumns
            },
            env: {
                // Show masked connection string to identify DB
                url_prefix: process.env.POSTGRES_PRISMA_URL ? process.env.POSTGRES_PRISMA_URL.substring(0, 20) + '...' : 'Not Set'
            }
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Failed to query database info',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
