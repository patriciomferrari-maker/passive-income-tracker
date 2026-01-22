'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Settings, ShoppingCart, TrendingUp, BarChart3, LayoutDashboard, ArrowLeft, Briefcase } from 'lucide-react';
import { DashboardTab } from '@/components/treasury/DashboardTab';
import { ConfigurationTab } from '@/components/treasury/ConfigurationTab';
import { PurchasesTab } from '@/components/on/PurchasesTab'; // Reusing generic component
import { HoldingsTab } from '@/components/on/HoldingsTab';   // Reusing generic component
import { IndividualCashflowTab } from '@/components/treasury/IndividualCashflowTab';
import { ConsolidatedCashflowTab } from '@/components/treasury/ConsolidatedCashflowTab';
import Link from 'next/link';

export default function TreasuryManagementPage() {
    const [activeTab, setActiveTab] = useState('dashboard');

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'holdings', label: 'Tenencia', icon: Briefcase },
        { id: 'purchases', label: 'Operaciones', icon: ShoppingCart },
        { id: 'individual', label: 'Flujo por Treasury', icon: TrendingUp },
        { id: 'consolidated', label: 'Flujo Consolidado', icon: BarChart3 },
        { id: 'config', label: 'Configuración', icon: Settings }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="container mx-auto p-4 sm:p-8">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent hover:text-blue-400 text-slate-400">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                        </Button>
                    </Link>
                    <h1 className="text-4xl font-bold text-white mb-2">Cartera USA</h1>
                    <p className="text-slate-300">Gestiona tu cartera de activos en Estados Unidos (ETFs, Treasuries)</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="min-h-[600px]">
                    {activeTab === 'dashboard' && <DashboardTab />}
                    {activeTab === 'holdings' && <HoldingsTab market="US" />}
                    {activeTab === 'purchases' && <PurchasesTab market="US" />}
                    {activeTab === 'individual' && <IndividualCashflowTab />}
                    {activeTab === 'consolidated' && <ConsolidatedCashflowTab />}
                    {activeTab === 'config' && <ConfigurationTab />}
                </div>
            </div>
        </div>
    );
}
