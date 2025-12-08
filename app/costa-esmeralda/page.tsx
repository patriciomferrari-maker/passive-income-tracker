'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CostaDashboardTab } from '@/components/costa/CostaDashboardTab';
import { TransactionsTab } from '@/components/costa/TransactionsTab';
import { ConfigurationTab } from '@/components/costa/ConfigurationTab';
import { NotesTab } from '@/components/costa/NotesTab';
import { CashflowTab } from '@/components/costa/CashflowTab';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CostaEsmeraldaPage() {
    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <Link href="/">
                        <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent hover:text-blue-400 text-slate-400">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2">Costa Esmeralda 🏖️</h1>
                    <p className="text-slate-400">Gestión de alquileres y mantenimiento</p>
                </div>

                <Tabs defaultValue="dashboard" className="space-y-6">
                    <TabsList className="bg-slate-900 border-slate-800">
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
                        <TabsTrigger value="rentals">Alquileres</TabsTrigger>
                        <TabsTrigger value="expenses">Gastos</TabsTrigger>
                        <TabsTrigger value="notes">Anotaciones</TabsTrigger>
                        <TabsTrigger value="config">Configuración</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard"><CostaDashboardTab /></TabsContent>
                    <TabsContent value="cashflow"><CashflowTab /></TabsContent>
                    <TabsContent value="rentals"><TransactionsTab type="INCOME" /></TabsContent>
                    <TabsContent value="expenses"><TransactionsTab type="EXPENSE" /></TabsContent>
                    <TabsContent value="notes"><NotesTab /></TabsContent>
                    <TabsContent value="config"><ConfigurationTab /></TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
