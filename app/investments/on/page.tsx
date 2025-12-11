'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, ShoppingCart, TrendingUp, BarChart3, LayoutDashboard, ArrowLeft, Briefcase } from 'lucide-react';
import { DashboardTab } from '@/components/on/DashboardTab';
import { ConfigurationTab } from '@/components/on/ConfigurationTab';
import { PurchasesTab } from '@/components/on/PurchasesTab';
import { HoldingsTab } from '@/components/on/HoldingsTab';
import { IndividualCashflowTab } from '@/components/on/IndividualCashflowTab';
import { ConsolidatedCashflowTab } from '@/components/on/ConsolidatedCashflowTab';
import Link from 'next/link';

export default function ONManagementPage() {
    const [activeTab, setActiveTab] = useState('dashboard');

    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'holdings', label: 'Tenencia', icon: Briefcase },
        { id: 'purchases', label: 'Operaciones', icon: ShoppingCart },
        { id: 'individual', label: 'Flujo por ON', icon: TrendingUp },
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
                    <h1 className="text-4xl font-bold text-white mb-2">Cartera Argentina</h1>
                    <p className="text-slate-300">Gestiona tus inversiones en ONs, CEDEARs y ETFs</p>
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
                    {activeTab === 'config' && <ConfigurationTab />}
                    {activeTab === 'holdings' && <HoldingsTab />}
                    {activeTab === 'purchases' && <PurchasesTab />}
                    {activeTab === 'individual' && <IndividualCashflowTab />}
                    {activeTab === 'consolidated' && <ConsolidatedCashflowTab />}
                </div>
            </div>
        </div>
    );
}
