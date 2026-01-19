
import React from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Not logged in → redirect to login
    if (!session?.user) {
        redirect('/login?callbackUrl=/admin');
    }

    // Logged in but not admin → redirect to dashboard
    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-8">
                    Panel de Administración
                </h1>
                {children}
            </div>
        </div>
    );
}
