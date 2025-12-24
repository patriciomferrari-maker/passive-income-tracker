import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Temporary endpoint to reset password in production
// DELETE THIS FILE after use for security
export async function POST(request: Request) {
    try {
        // Super secret key - change this!
        const authHeader = request.headers.get('authorization');
        const SECRET_KEY = process.env.ADMIN_SECRET || 'mi-secreto-super-seguro-123';

        if (authHeader !== `Bearer ${SECRET_KEY}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { email, newPassword } = await request.json();

        if (!email || !newPassword) {
            return NextResponse.json({ error: 'Email and newPassword required' }, { status: 400 });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        return NextResponse.json({
            success: true,
            message: 'Password updated successfully',
            user: { email: user.email, name: user.name }
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
