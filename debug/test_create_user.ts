
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('Starting user creation test...');
    const email = `test_user_${Date.now()}@example.com`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: {
                name: 'Test User',
                email: email,
                password: hashedPassword,
                role: 'user',
            }
        });
        console.log('User created successfully:', user.id);

        // Cleanup
        await prisma.user.delete({ where: { id: user.id } });
        console.log('User deleted successfully.');
    } catch (e) {
        console.error('Error creating user:', e);
    }
}

main();
