import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { regenerateContractCashflows } from '@/lib/rentals';

export async function POST() {
    try {
        // Get all contracts
        const contracts = await prisma.contract.findMany();

        let regenerated = 0;

        // Regenerate cashflows for each contract
        for (const contract of contracts) {
            await regenerateContractCashflows(contract.id);
            regenerated++;
        }

        return NextResponse.json({
            message: 'Cashflows regenerated successfully',
            contractsProcessed: regenerated
        });
    } catch (error) {
        console.error('Error regenerating cashflows:', error);
        return NextResponse.json({ error: 'Failed to regenerate cashflows' }, { status: 500 });
    }
}
