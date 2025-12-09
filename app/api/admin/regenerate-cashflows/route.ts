
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { regenerateContractCashflows } from '@/lib/rentals';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        console.log('Regenerating all contract cashflows...');
        const contracts = await prisma.contract.findMany();
        const results = [];

        for (const contract of contracts) {
            try {
                await regenerateContractCashflows(contract.id);
                results.push({ id: contract.id, status: 'success', tenant: contract.tenantName });
            } catch (e: any) {
                console.error(`Error regenerating ${contract.id}:`, e);
                results.push({ id: contract.id, status: 'error', error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
