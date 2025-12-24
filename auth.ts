import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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

                    // If user has no password (OAuth only), return null for Credentials provider
                    if (!user.password) return null;

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
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token, user, account }) {
            // On initial sign in, user object is present
            if (user) {
                // For Credentials provider, user.id is already set by authorize()
                if (user.id) {
                    token.sub = user.id;
                }

                // For OAuth providers (Google), look up or create user
                if (account && account.provider === 'google' && user.email) {
                    const dbUser = await prisma.user.findUnique({
                        where: { email: user.email }
                    });

                    if (dbUser) {
                        token.sub = dbUser.id;
                        token.role = dbUser.role;
                    } else {
                        // Auto-create user for Google Sign Up
                        const newUser = await prisma.user.create({
                            data: {
                                email: user.email,
                                name: user.name,
                                password: '', // No password for OAuth
                                role: 'user'
                            }
                        });
                        // Create Settings
                        await prisma.appSettings.create({
                            data: {
                                userId: newUser.id,
                                reportDay: 1,
                                reportHour: 10,
                                enabledSections: ''
                            }
                        });
                        token.sub = newUser.id;
                    }
                }
            }
            return token;
        }
    },
    cookies: {
        sessionToken: {
            name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            }
        }
    },
    session: {
        strategy: 'jwt',
        maxAge: 3600, // 1 Hour
        updateAge: 300, // Update session every 5 minutes if active
    }
});
