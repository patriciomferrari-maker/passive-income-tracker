
'use server';

import { signIn, signOut, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { redirect } from 'next/navigation';

import { headers } from 'next/headers';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    const email = formData.get('email') as string;
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') ?? 'unknown';
    const userAgent = headerList.get('user-agent') ?? 'unknown';

    try {
        console.log('[Actions] Calling signIn with credentials...');
        await signIn('credentials', {
            ...Object.fromEntries(formData),
            redirectTo: '/'
        });

        // If we get here (which usually doesn't happen due to redirect), log success
        // But mainly success is handled via the specific redirect error catch or implicitly
    } catch (error) {
        console.error('[Actions] signIn error:', error);
        if (error instanceof AuthError) {
            // Log Failure
            await prisma.accessLog.create({
                data: {
                    email,
                    action: 'LOGIN',
                    status: 'FAILURE',
                    details: error.type,
                    ip,
                    userAgent
                }
            });

            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Contraseña incorrecta.';
                default:
                    return 'Algo salió mal.';
            }
        }

        // If it's the NEXT_REDIRECT error, it means SUCCESS
        if ((error as Error).message === 'NEXT_REDIRECT') {
            await prisma.accessLog.create({
                data: {
                    email,
                    action: 'LOGIN',
                    status: 'SUCCESS',
                    ip,
                    userAgent
                }
            });
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
    console.log('[Register Action] Start');
    const validatedFields = RegisterSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
        console.log('[Register Action] Validation failed');
        return "Datos inválidos (Contraseña min 6 caracteres).";
    }

    const { name, email, password } = validatedFields.data;
    console.log('[Register Action] Validated:', { email, name });

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            console.log('[Register Action] User exists');
            return "El email ya está registrado.";
        }

        console.log('[Register Action] Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('[Register Action] Creating user...');
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'user', // Default role
            }
        });
        console.log('[Register Action] User created:', newUser.id);

        // Create default settings separately to avoid nested transaction issues
        console.log('[Register Action] Creating settings...');
        await prisma.appSettings.create({
            data: {
                userId: newUser.id,
                reportDay: 1,
                reportHour: 10,
                enabledSections: '' // Default empty, waiting for onboarding
            }
        });
        console.log('[Register Action] Settings created. Redirecting...');

        // Redirect handled in component or return success to trigger redirect
        // Ideally we redirect, but for actions we might return undefined or throw redirect
    } catch (error) {
        console.error("Registration error:", error);
        return `Error: ${(error as any)?.message || 'Unknown error'}`;
    }

    // Auto-login after registration
    console.log('[Register Action] Auto-logging in...');
    await signIn('credentials', {
        email,
        password,
        redirectTo: '/'
    });
}

export async function signOutAction() {
    await signOut({ redirectTo: '/login' });
}

export async function signInGoogle() {
    await signIn('google', { redirectTo: '/' });
}

export async function saveOnboarding(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) {
        return "No autorizado";
    }

    // Get all checked values (they share the name 'sections')
    const selectedSections = formData.getAll('sections');

    let sectionsString = '';
    if (selectedSections.length > 0) {
        sectionsString = selectedSections.join(',');
    } else {
        sectionsString = 'none';
    }

    try {
        await prisma.appSettings.update({
            where: { userId: session.user.id },
            data: { enabledSections: sectionsString }
        });
    } catch (error) {
        console.error("Onboarding error:", error);
        return "Error al guardar preferencias";
    }

    redirect('/');
}
