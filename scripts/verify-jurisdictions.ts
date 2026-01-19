import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyJurisdictions() {
    try {
        console.log('📊 Checking properties with jurisdictions...\n');

        const properties = await prisma.property.findMany({
            select: {
                name: true,
                jurisdiction: true,
                user: {
                    select: {
                        email: true
                    }
                }
            }
        });

        properties.forEach(p => {
            console.log(`  - ${p.name} (${p.user.email}): ${p.jurisdiction}`);
        });

        console.log('\n✅ Verification complete!');

    } catch (error) {
        console.error('❌ Verification failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

verifyJurisdictions();
