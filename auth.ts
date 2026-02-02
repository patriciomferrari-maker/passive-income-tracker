import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    trustHost: true, // Required for Vercel and production
    debug: process.env.NODE_ENV === 'development',
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials) => {
                console.log('[Auth] === AUTHORIZE CALLBACK START ===');
                try {
                    console.log('[Auth] Step 1: Parsing credentials...');
                    const parsedCredentials = z
                        .object({
                            email: z.string().email(),
                            password: z.string().min(1)
                        })
                        .safeParse(credentials);

                    if (!parsedCredentials.success) {
                        console.log('[Auth] Invalid credentials format');
                        return null;
                    }

                    const { email, password } = parsedCredentials.data;
                    console.log('[Auth] Step 2: Credentials parsed, email:', email);

                    console.log('[Auth] Step 3: Querying database for user...');
                    const user = await prisma.user.findUnique({
                        where: { email },
                        select: { id: true, email: true, name: true, role: true, password: true }
                    });
                    console.log('[Auth] Step 4: Database query complete, user found:', !!user);

                    if (!user) {
                        console.log('[Auth] User not found:', email);
                        return null;
                    }

                    // If user has no password (OAuth only), return null for Credentials provider
                    if (!user.password) {
                        console.log('[Auth] User has no password (OAuth only)');
                        return null;
                    }

                    console.log('[Auth] Step 5: Comparing passwords...');
                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    console.log('[Auth] Step 6: Password comparison complete, match:', passwordsMatch);

                    if (passwordsMatch) {
                        console.log('[Auth] ✅ Login successful:', user.email);
                        return {
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role
                        };
                    }

                    console.log('[Auth] ❌ Invalid password for:', email);
                    return null;
                } catch (error) {
                    console.error('[Auth] ❌ ERROR in authorize:', error);
                    console.error('[Auth] Error details:', {
                        name: error instanceof Error ? error.name : 'Unknown',
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    });
                    return null;
                }
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
            console.log('[Auth] === SESSION CALLBACK ===');
            console.log('[Auth] Token sub:', token.sub);
            console.log('[Auth] Session user exists:', !!session.user);
            if (token.sub && session.user) {
                session.user.id = token.sub;
                if (token.role) {
                    session.user.role = token.role as string;
                }
                console.log('[Auth] ✅ Session user ID set:', session.user.id);
            }
            return session;
        },
        async jwt({ token, user, account }) {
            console.log('[Auth] === JWT CALLBACK ===');
            console.log('[Auth] User object present:', !!user);
            console.log('[Auth] Account present:', !!account);
            console.log('[Auth] Token sub:', token.sub);
            try {
                // On initial sign in, user object is present
                if (user) {
                    // For Credentials provider, user.id and role are already set by authorize()
                    if (user.id) {
                        token.sub = user.id;
                        if (user.role) {
                            token.role = user.role;
                        }
                    }

                    // For OAuth providers (Google), look up or create user  
                    if (account && account.provider === 'google' && user.email) {
                        const dbUser = await prisma.user.findUnique({
                            where: { email: user.email },
                            select: { id: true, email: true, name: true, role: true } // Only select fields we need
                        });

                        if (dbUser) {
                            token.sub = dbUser.id;
                            token.role = dbUser.role;
                        } else {
                            const newUser = await prisma.user.create({
                                data: {
                                    email: user.email,
                                    name: user.name,
                                    password: '', // No password for OAuth
                                    role: 'USER' // Default role for new users
                                },
                                select: { id: true, role: true }
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
                            token.role = newUser.role;
                        }
                    }
                }
                // Role is now stored in token, no need to fetch from DB on subsequent requests
                return token;
            } catch (error) {
                console.error('[Auth] Error in jwt callback:', error);
                // Return token as-is if there's an error, don't break the flow
                return token;
            }
        }
    },
    session: {
        strategy: 'jwt',
        maxAge: 900, // 15 Minutes
        updateAge: 300, // Update session every 5 minutes if active
    }
});
