
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, Flame, Building, AlertCircle, CheckCircle } from 'lucide-react';

export function ServicesTab() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/hogar/utilities');
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCheck = async () => {
        setChecking(true);
        try {
            await fetch('/api/hogar/utilities/check', { method: 'POST' });
            await fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setChecking(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'ELECTRICITY': return <Zap className="w-5 h-5 text-yellow-400" />;
            case 'GAS': return <Flame className="w-5 h-5 text-orange-400" />;
            case 'MUNICIPAL': return <Building className="w-5 h-5 text-blue-400" />;
            default: return <Building className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusBadge = (status: string, debt: number) => {
        if (status === 'ERROR') return <Badge variant="destructive" className="bg-red-900/50 text-red-200">Error</Badge>;
        if (status === 'DEBT' || debt > 0) return <Badge variant="destructive" className="bg-red-600">Deuda: ${debt}</Badge>;
        if (status === 'OK' || status === 'UP_TO_DATE') return <Badge className="bg-green-600">Al día</Badge>;
        return <Badge variant="secondary">{status}</Badge>;
    };

    if (loading) return <div className="p-8 text-center text-slate-400 animate-pulse">Cargando estado de servicios...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Estado de Servicios</h2>
                    <p className="text-slate-400">Monitoreo automático de Edenor, Metrogas y ABL</p>
                </div>
                <Button
                    onClick={handleCheck}
                    disabled={checking}
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
                >
                    <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                    {checking ? 'Verificando...' : 'Verificar Ahora'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.map((prop) => (
                    <Card key={prop.id} className="bg-slate-900 border-slate-800">
                        <CardHeader className="pb-3 border-b border-slate-800 bg-slate-950/30">
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <Building className="w-4 h-4 text-slate-500" />
                                {prop.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {prop.checks.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No hay servicios configurados o verificados.</p>
                            ) : (
                                prop.checks.map((check: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded bg-slate-950/50 border border-slate-800/50">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                                {getIcon(check.serviceType)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-200 text-sm">
                                                    {check.serviceType === 'ELECTRICITY' ? 'Edenor' :
                                                        check.serviceType === 'GAS' ? 'Gas' :
                                                            check.serviceType === 'MUNICIPAL_GARAGE' ? 'ABL Cochera' : 'ABL'}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-mono">{check.accountNumber}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {getStatusBadge(check.status, check.debtAmount)}
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                {new Date(check.checkDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {data.length === 0 && !loading && (
                <div className="text-center p-12 bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">
                    <p className="text-slate-400">No se encontraron propiedades con servicios configurados.</p>
                </div>
            )}
        </div>
    );
}
