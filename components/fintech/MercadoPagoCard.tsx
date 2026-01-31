
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wallet, ShieldCheck, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface FintechAccount {
    id: string;
    balance: number;
    yield: number | null; // TNA
    lastSync: Date | string | null;
    status: string | null;
}

interface Props {
    account?: FintechAccount;
    onSync: () => Promise<void>;
}

export function MercadoPagoCard({ account, onSync }: Props) {
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await onSync();
        } finally {
            setSyncing(false);
        }
    };

    // Default numbers if no account yet (for demo/onboard)
    const balance = account?.balance ?? 0;
    const tna = account?.yield ?? 0;
    const status = account?.status ?? 'DISCONNECTED';

    // Formatting
    const fmtBalance = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(balance);
    const lastUpdate = account?.lastSync ? new Date(account.lastSync).toLocaleString() : 'Nunca';

    return (
        <Card className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 border-blue-800 shadow-xl overflow-hidden relative min-h-[220px]">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Wallet size={120} className="text-blue-400" />
            </div>

            <div className="p-6 relative z-10 flex flex-col justify-between h-full">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-[#009EE3] rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                            MP
                        </div>
                        <div>
                            <h3 className="text-blue-100 font-bold text-lg leading-tight">Mercado Pago</h3>
                            <div className="flex items-center gap-1.5 text-xs text-blue-300/80">
                                <ShieldCheck size={12} />
                                <span>Conexión Segura</span>
                            </div>
                        </div>
                    </div>

                    {status === 'ACTIVE' ? (
                        <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10">
                            Activo
                        </Badge>
                    ) : status === 'ERROR' ? (
                        <Badge variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-400">
                            <AlertCircle size={12} className="mr-1" /> Error
                        </Badge>
                    ) : (
                        <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                            Desconectado
                        </Badge>
                    )}
                </div>

                {/* Balance Section */}
                <div className="space-y-1 mt-6">
                    <p className="text-xs text-blue-200 font-medium tracking-wide uppercase opacity-80">Saldo Disponible</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white tracking-tight">
                            {fmtBalance}
                        </span>
                    </div>
                    {tna > 0 && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#009EE3]/20 text-[#009EE3] text-xs font-bold mt-2 shadow-sm border border-[#009EE3]/30">
                            <span>⚡ Rendimiento: {tna}% TNA</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-6 mt-2 border-t border-white/10">
                    <p className="text-[10px] text-slate-400">
                        Última sincr: {lastUpdate}
                    </p>
                    <Button
                        size="sm"
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-[#009EE3] hover:bg-[#008CC9] text-white shadow-lg shadow-[#009EE3]/20 transition-all font-medium"
                    >
                        <RefreshCw size={14} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}
