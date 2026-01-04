
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Cleaning Up Specific Ghost Plans ---');

    // IDs identified as likely duplicates/typos based on analysis
    const idsToDelete = [
        'cmjx4hfuh001h18wp5obky8p6', // Abono Racing 550000.20 (Typo vs .02)
        'cmjx42l64001pgx3d5wiyqoyh', // Cerini 33000 (Round vs 37000.02)
        'cmjx49hy2000tbs1y0b6d3azc', // Buzo Adidas 35000 (Low vs 105000)
        'cmjqiohfs000113im24d159ky', // Regalo Fabi 59800 (Typo name vs Favi 59799)
        'cmjx49z2k0011bs1ye677ue8p', // Regalo Sofi 7777 (Test vs 69999)
    ];

    for (const id of idsToDelete) {
        const plan = await prisma.barbosaInstallmentPlan.findUnique({ where: { id } });
        if (plan) {
            console.log(`Deleting: ${plan.description} (${plan.totalAmount}) - ID: ${id}`);
            await prisma.barbosaInstallmentPlan.delete({ where: { id } });
        } else {
            console.log(`Plan not found: ${id}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
