
'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

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

export async function signOutAction() {
    await signOut();
}
