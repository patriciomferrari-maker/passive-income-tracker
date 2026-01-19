'use client';

import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'; // Import icons
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import { PropertiesTab } from '@/components/rentals/PropertiesTab';
import { ContractsTab } from '@/components/rentals/ContractsTab';
import { IndividualCashflowTab } from '@/components/rentals/IndividualCashflowTab';
import { ConsolidatedCashflowTab } from '@/components/rentals/ConsolidatedCashflowTab';
import { UtilitiesTab } from '@/components/rentals/UtilitiesTab';

import { DashboardTab } from '@/components/rentals/DashboardTab';

export default function AlquileresPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showValues, setShowValues] = useState(true); // Global visibility state

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'contracts', label: 'Contratos' },
        { id: 'individual', label: 'Flujo Individual' },
        { id: 'consolidated', label: 'Flujo Consolidado' },
        { id: 'properties', label: 'Propiedades' },
        { id: 'utilities', label: 'Servicios' }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="container mx-auto px-4 py-8">
                {/* Header with Toggle */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/">
                            <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent hover:text-blue-400 text-slate-400">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                            </Button>
                        </Link>
                        <h1 className="text-4xl font-bold text-white mb-2">
                            🏢 Alquileres
                        </h1>
                        <p className="text-slate-400">
                            Gestión de propiedades y contratos de alquiler
                        </p>
                    </div>
                    <button
                        onClick={() => setShowValues(!showValues)}
                        className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all shadow-lg border border-slate-700"
                        title={showValues ? "Ocultar valores" : "Mostrar valores"}
                    >
                        {showValues ? <Eye size={24} /> : <EyeOff size={24} />}
                    </button>
                </div>

                {/* Tabs */}
                <div className="mb-6 border-b border-slate-700">
                    <div className="flex gap-2 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                                    ? 'text-white border-b-2 border-blue-500'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content receiving showValues */}
                <div>
                    {activeTab === 'dashboard' && <DashboardTab showValues={showValues} />}
                    {activeTab === 'properties' && <PropertiesTab showValues={showValues} />}
                    {activeTab === 'contracts' && <ContractsTab showValues={showValues} />}
                    {activeTab === 'individual' && <IndividualCashflowTab showValues={showValues} />}
                    {activeTab === 'consolidated' && <ConsolidatedCashflowTab showValues={showValues} />}
                    {activeTab === 'utilities' && <UtilitiesTab showValues={showValues} />}
                </div>
            </div>
        </div>
    );
}
