'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DebtsDashboardTab } from '@/components/debts/DebtsDashboardTab';
import { DebtsConfigurationTab } from '@/components/debts/DebtsConfigurationTab';
import { DebtsTransactionTab } from '@/components/debts/DebtsTransactionTab';
import { DebtsFlowTab } from '@/components/debts/DebtsFlowTab';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DebtsPage() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showValues, setShowValues] = useState(true);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
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
                            💰 Gestión de Deudas
                        </h1>
                        <p className="text-slate-400">
                            Préstamos personales y cuentas por cobrar/pagar
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
                <Tabs defaultValue="dashboard" className="w-full space-y-6">
                    <TabsList className="bg-slate-900 border border-slate-800 p-1 grid grid-cols-4 w-full max-w-4xl">
                        <TabsTrigger value="dashboard" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="transaction" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            Registrar Movimiento
                        </TabsTrigger>
                        <TabsTrigger value="flow" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            Flujo de Deudas
                        </TabsTrigger>
                        <TabsTrigger value="config" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
                            Configuración
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
                        <DebtsDashboardTab showValues={showValues} />
                    </TabsContent>

                    <TabsContent value="transaction" className="mt-0 focus-visible:outline-none">
                        <DebtsTransactionTab showValues={showValues} />
                    </TabsContent>

                    <TabsContent value="flow" className="mt-0 focus-visible:outline-none">
                        <DebtsFlowTab showValues={showValues} />
                    </TabsContent>

                    <TabsContent value="config" className="mt-0 focus-visible:outline-none">
                        <DebtsConfigurationTab showValues={showValues} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
