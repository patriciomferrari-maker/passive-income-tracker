
import { prisma } from '../lib/prisma';
import { regenerateContractCashflows } from '../lib/rentals';

async function main() {
    console.log('Fetching all contracts...');
    const contracts = await prisma.contract.findMany();
    console.log(`Found ${contracts.length} contracts.`);

    for (const contract of contracts) {
        console.log(`Regenerating cashflows for contract ${contract.id} (${contract.tenantName})...`);
        try {
            await regenerateContractCashflows(contract.id);
            console.log(`✅ Success for ${contract.id}`);
        } catch (e: any) {
            console.error(`❌ Failed for ${contract.id}:`, e.message);
        }
    }

    console.log('Done.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
