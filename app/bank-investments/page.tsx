'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { BankDashboardTab } from '@/components/bank/BankDashboardTab';
import { BankOperationsTab } from '@/components/bank/BankOperationsTab';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BankOperationForm } from '@/components/bank/BankOperationForm';

export default function BankInvestmentsPage() {
    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);
    const [operations, setOperations] = useState([]);
    const [stats, setStats] = useState({ totalARS: 0, totalUSD: 0, estimatedInterest: 0 });

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/bank-investments');
            const data = await res.json();
            setOperations(data.operations || []);
            setStats(data.stats || { totalARS: 0, totalUSD: 0, estimatedInterest: 0 });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-blue-400 text-slate-400">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-1">Inversiones Banco</h1>
                            <p className="text-slate-400 text-sm">Plazos Fijos, FCI y Caja de Seguridad</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowValues(!showValues)}
                        className="border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                        title={showValues ? "Ocultar valores" : "Mostrar valores"}
                    >
                        {showValues ? <Eye size={18} /> : <EyeOff size={18} />}
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-blue-500 w-10 h-10" />
                    </div>
                ) : (
                    <Tabs defaultValue="dashboard" className="space-y-6">
                        <TabsList className="bg-slate-900 border-slate-800">
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="operations">Operaciones</TabsTrigger>
                            <TabsTrigger value="new-operation">Nueva Operación</TabsTrigger>
                        </TabsList>

                        <TabsContent value="dashboard">
                            <BankDashboardTab stats={stats} operations={operations} showValues={showValues} />
                        </TabsContent>

                        <TabsContent value="operations">
                            <BankOperationsTab operations={operations} onRefresh={loadData} showValues={showValues} />
                        </TabsContent>

                        <TabsContent value="new-operation">
                            <Card className="bg-slate-900 border-slate-800 max-w-2xl mx-auto">
                                <CardHeader>
                                    <CardTitle className="text-white">Nueva Operación Bancaria</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <BankOperationForm onSaved={() => {
                                        loadData();
                                        // Optional: Switch back to dashboard or operations?
                                        // For now, reload data. Could start a toast or switch tab.
                                    }} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    );
}
