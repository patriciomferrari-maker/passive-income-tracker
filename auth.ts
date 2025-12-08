import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                const parsedCredentials = z
                    .object({
                        email: z.string().email(),
                        password: z.string().min(1)
                    })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    const user = await prisma.user.findUnique({
                        where: { email }
                    });

                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) {
                        return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        };
                    }
                }
                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
            }
            return token;
        }
    }
});
