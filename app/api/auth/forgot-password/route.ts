import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // 1. Check if user exists
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Don't reveal user existence
            return NextResponse.json({ message: 'If account exists, email sent' });
        }

        // 2. Generate Reset Token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // 3. Save hashed token to DB (optional: hash it for security, but for simplicity we often store raw or hash)
        // Here we store it directly as it is a random token.
        await prisma.user.update({
            where: { email },
            data: {
                resetToken,
                resetTokenExpiry,
            },
        });

        // 4. Send Email
        // Replace with your actual domain/url
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        await resend.emails.send({
            from: 'Soporte <onboarding@resend.dev>', // Or your verified domain
            to: email,
            subject: 'Restaurar Contraseña - Passive Income Tracker',
            html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Solicitud de restauración de contraseña</h2>
          <p>Has solicitado restaurar tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
          <p>
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Restaurar Contraseña
            </a>
          </p>
          <p style="font-size: 12px; color: #666;">O copia este enlace: ${resetUrl}</p>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste esto, ignora este correo.</p>
        </div>
      `,
        });

        return NextResponse.json({ message: 'Email sent' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
