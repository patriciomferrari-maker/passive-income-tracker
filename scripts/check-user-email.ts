import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find all users with their properties
    const users = await prisma.user.findMany({
        include: {
            properties: {
                include: {
                    contracts: {
                        where: {
                            adjustmentType: 'IPC'
                        }
                    }
                }
            }
        }
    });

    console.log('\n📧 Users with rental contracts:\n');

    for (const user of users) {
        if (user.properties.length > 0) {
            console.log(`User: ${user.name || 'N/A'}`);
            console.log(`Email: ${user.email}`);
            console.log(`Properties:`);
            user.properties.forEach(prop => {
                console.log(`  - ${prop.name} (${prop.contracts.length} IPC contracts)`);
            });
            console.log('');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
