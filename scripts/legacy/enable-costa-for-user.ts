import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enableCostaForUser(email: string) {
    console.log(`🏠 Enabling Costa (Hogar) section for: ${email}`);

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true }
        });

        if (!user) {
            console.error(`❌ User not found: ${email}`);
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user.email})`);

        let settings = await prisma.appSettings.findUnique({
            where: { userId: user.id }
        });

        if (!settings) {
            console.log('No settings found. Creating with costa enabled...');
            await prisma.appSettings.create({
                data: {
                    userId: user.id,
                    enabledSections: 'costa',
                    reportDay: 1,
                    reportHour: 10
                }
            });
            console.log('✅ Settings created with costa enabled');
        } else {
            console.log(`Current sections: ${settings.enabledSections || '(empty)'}`);
            const sections = settings.enabledSections ? settings.enabledSections.split(',') : [];

            if (sections.includes('costa')) {
                console.log('✅ Costa is already enabled!');
            } else {
                sections.push('costa');
                await prisma.appSettings.update({
                    where: { id: settings.id },
                    data: { enabledSections: sections.join(',') }
                });
                console.log(`✅ Added costa. New sections: ${sections.join(',')}`);
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

const email = process.argv[2] || 'test@test.com';
enableCostaForUser(email);
