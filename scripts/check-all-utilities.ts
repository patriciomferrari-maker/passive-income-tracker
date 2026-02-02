
// Script wrapper to run utility checks conveniently
// Usage: npx tsx scripts/check-all-utilities.ts

import { checkAllUtilities } from '@/app/lib/utility-checker';
import { prisma } from '@/lib/prisma';

async function main() {
    console.log('🚀 Starting Manual Utilities Check Script');

    // Get the main user (hardcoded for verify or find first with properties)
    const user = await prisma.user.findUnique({
        where: { email: 'patriciomferrari@gmail.com' }
    }) || await prisma.user.findFirst({
        where: {
            properties: {
                some: {
                    OR: [
                        { gasId: { not: null } },
                        { electricityId: { not: null } }
                    ]
                }
            }
        }
    });

    if (!user) {
        console.error('❌ No user found in database');
        process.exit(1);
    }

    try {
        const summary = await checkAllUtilities(user.id);

        console.log('\n=========================================');
        console.log('   Utilities Checker - Completed');
        console.log('=========================================');
        console.log(`Summary: ${summary.upToDate} OK, ${summary.overdue} Overdue, ${summary.errors} Errors`);

    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
