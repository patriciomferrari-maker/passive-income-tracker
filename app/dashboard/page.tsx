'use client';

import { GlobalDashboardTab } from '@/components/global/GlobalDashboardTab';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GlobalDashboardPage() {
    return (
        <div className="min-h-screen bg-slate-950">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Back Link */}
                <div className="mb-6">
                    <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} className="mr-2" />
                        Volver al Inicio
                    </Link>
                </div>

                {/* Dashboard Content */}
                <GlobalDashboardTab />
            </div>
        </div>
    );
}
