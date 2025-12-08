
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({ password: z.string().min(1) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { password } = parsedCredentials.data;
                    const adminPassword = process.env.ADMIN_PASSWORD;

                    // Simple check
                    if (adminPassword && password === adminPassword) {
                        return { id: 'admin', name: 'Admin', email: 'admin@local' };
                    }
                }
                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});
