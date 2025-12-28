'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Tabs
import { DashboardTab } from '@/components/barbosa/DashboardTab';
import { CleaningTab } from '@/components/barbosa/CleaningTab';
import { CashflowTab } from '@/components/barbosa/CashflowTab';
import { TransactionsTab } from '@/components/barbosa/TransactionsTab';
import { SettingsTab } from '@/components/barbosa/SettingsTab';
import { RecurrenceTab } from '@/components/barbosa/RecurrenceTab';
import { InstallmentsTab } from '@/components/barbosa/InstallmentsTab';

export default function BarbosaPage() {
    const [activeTab, setActiveTab] = useState('dashboard');

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'cashflow', label: 'Cashflow' },
        { id: 'cleaning', label: 'Limpieza' },
        { id: 'transactions', label: 'Carga' },
        { id: 'installments', label: 'Cuotas' },
        { id: 'recurrence', label: 'Recurrentes' },
        { id: 'settings', label: 'Configuración' }
    ];

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/">
                            <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent hover:text-blue-400 text-slate-400">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                            </Button>
                        </Link>
                        <h1 className="text-4xl font-bold text-white mb-2">
                            🏠 Hogar
                        </h1>
                        <p className="text-slate-400">
                            Gestión de gastos, limpieza y mantenimiento
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6 border-b border-slate-800 overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === tab.id
                                    ? 'text-white border-blue-500'
                                    : 'text-slate-400 border-transparent hover:text-white hover:border-slate-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-[500px]">
                    {activeTab === 'dashboard' && <DashboardTab />}
                    {activeTab === 'cleaning' && <CleaningTab />}
                    {activeTab === 'cashflow' && <CashflowTab />}
                    {activeTab === 'transactions' && <TransactionsTab />}
                    {activeTab === 'recurrence' && <RecurrenceTab />}
                    {activeTab === 'settings' && <SettingsTab />}
                </div>
            </div>
        </div>
    );
}
