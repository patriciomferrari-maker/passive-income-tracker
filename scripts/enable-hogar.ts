
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Enabling Hogar Section ---');

    // Target user
    const email = 'patriciomferrari@gmail.com';
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) throw new Error('User not found');

    const settings = await prisma.appSettings.findUnique({ where: { userId: user.id } });

    if (!settings) {
        console.log('No settings found. Creating default with barbosa enabled...');
        await prisma.appSettings.create({
            data: {
                userId: user.id,
                enabledSections: 'on,treasury,rentals,debts,bank,crypto,costa,barbosa' // Enabled all + barbosa
            }
        });
    } else {
        console.log('Current sections:', settings.enabledSections);
        const sections = settings.enabledSections ? settings.enabledSections.split(',') : [];

        if (!sections.includes('barbosa')) {
            console.log('Adding "barbosa" to enabled sections...');
            sections.push('barbosa');

            await prisma.appSettings.update({
                where: { id: settings.id },
                data: {
                    enabledSections: sections.join(',')
                }
            });
        } else {
            console.log('"barbosa" is already enabled.');
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
