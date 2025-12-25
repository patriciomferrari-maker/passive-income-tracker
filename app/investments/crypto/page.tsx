'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import DashboardTab from './components/DashboardTab';
import TenenciaTab from './components/TenenciaTab';
import OperacionesTab from './components/OperacionesTab';
import ConfiguracionTab from './components/ConfiguracionTab';

type Tab = 'dashboard' | 'tenencia' | 'operaciones' | 'configuracion';

export default function CryptoPage() {
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');

    const tabs = [
        { id: 'dashboard' as Tab, label: 'Dashboard', icon: '📊' },
        { id: 'tenencia' as Tab, label: 'Tenencia', icon: '💰' },
        { id: 'operaciones' as Tab, label: 'Operaciones', icon: '📝' },
        { id: 'configuracion' as Tab, label: 'Configuración', icon: '⚙️' }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => window.history.back()}
                    className="text-slate-400 hover:text-white mb-4 flex items-center gap-2"
                >
                    ← Volver
                </button>
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-orange-500 to-yellow-500 p-4 rounded-2xl">
                        <Coins className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold">Cartera Crypto</h1>
                        <p className="text-slate-400 text-lg">Bitcoin, Ethereum y otras criptomonedas</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              px-6 py-3 font-medium transition-all flex items-center gap-2
              ${activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-950/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }
            `}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'tenencia' && <TenenciaTab />}
                {activeTab === 'operaciones' && <OperacionesTab />}
                {activeTab === 'configuracion' && <ConfiguracionTab />}
            </div>
        </div>
    );
}
