
'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { redirect } from 'next/navigation';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Contraseña incorrecta.';
                default:
                    return 'Algo salió mal.';
            }
        }
        throw error;
    }
}

const RegisterSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
});

export async function register(prevState: string | undefined, formData: FormData) {
    const validatedFields = RegisterSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        return "Datos inválidos (Contraseña min 6 caracteres).";
    }

    const { name, email, password } = validatedFields.data;

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return "El email ya está registrado.";
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'user', // Default role
                appSettings: {
                    create: {
                        reportDay: 1,
                        reportHour: 10
                    }
                }
            }
        });

        // Redirect handled in component or return success to trigger redirect
        // Ideally we redirect, but for actions we might return undefined or throw redirect
    } catch (error) {
        console.error("Registration error:", error);
        return "Error al crear el usuario.";
    }

    redirect('/login?registered=true');
}

export async function signOutAction() {
    await signOut();
}
