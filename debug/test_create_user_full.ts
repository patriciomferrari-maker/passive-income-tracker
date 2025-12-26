
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('Starting FULL user creation test (User + AppSettings)...');
    const email = `test_full_${Date.now()}@example.com`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    let userId = '';

    try {
        console.log('1. Creating User...');
        const user = await prisma.user.create({
            data: {
                name: 'Test Full',
                email: email,
                password: hashedPassword,
                role: 'user',
            }
        });
        userId = user.id;
        console.log('User created:', userId);

        console.log('2. Creating AppSettings...');
        const settings = await prisma.appSettings.create({
            data: {
                userId: userId,
                reportDay: 1,
                reportHour: 10,
                enabledSections: ''
            }
        });
        console.log('AppSettings created:', settings.id);

        console.log('SUCCESS: Full flow finished.');

    } catch (e) {
        console.error('ERROR in flow:', e);
    } finally {
        if (userId) {
            console.log('Cleaning up...');
            await prisma.user.delete({ where: { id: userId } }); // Cascade should delete settings
            console.log('Cleanup done.');
        }
    }
}

main();
