'use client';

interface UtilityCheck {
    id: string;
    serviceType: string;
    status: string;
    debtAmount: number | null;
    lastBillAmount: number | null;
    checkDate: string;
    isAutomatic: boolean;
    errorMessage: string | null;
}

interface PropertyData {
    id: string;
    name: string;
    jurisdiction: 'CABA' | 'PROVINCIA';
    gasId: string | null;
    electricityId: string | null;
    aysaId: string | null;
    municipalId: string | null;
    garageMunicipalId: string | null;
    hasGarage: boolean;
    checks: {
        gas: UtilityCheck | null;
        electricity: UtilityCheck | null;
        aysa: UtilityCheck | null;
        municipal: UtilityCheck | null;
        garageMunicipal: UtilityCheck | null;
    };
}

interface Props {
    servicesData: PropertyData[];
}

export default function ServicesDashboardPrint({ servicesData }: Props) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    };

    const getStatusBadge = (status: string, debtAmount: number | null) => {
        if (status === 'UP_TO_DATE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ✓ Al día
                </span>
            );
        } else if (status === 'OVERDUE') {
            return (
                <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <span className="text-[10px] font-bold opacity-80">⚠ DEUDA</span>
                    {debtAmount && <span className="text-sm font-bold">{formatCurrency(debtAmount)}</span>}
                </div>
            );
        } else if (status === 'ERROR') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    ⚠ Error
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-400 border border-slate-600">
                Sin verificar
            </span>
        );
    };

    const getGasProvider = (jurisdiction: 'CABA' | 'PROVINCIA') => {
        return jurisdiction === 'CABA' ? 'Metrogas' : 'Naturgy';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Estado de Servicios</h1>
                    <p className="text-slate-400 text-sm">
                        Monitoreo automático de Gas, Electricidad y ABL
                    </p>
                </div>

                {/* Services Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                                <th className="text-left py-4 px-4 text-slate-300 font-semibold text-sm">Propiedad</th>
                                <th className="text-center py-4 px-4 text-slate-300 font-semibold text-sm">Gas</th>
                                <th className="text-center py-4 px-4 text-slate-300 font-semibold text-sm">AYSA</th>
                                <th className="text-center py-4 px-4 text-slate-300 font-semibold text-sm">Electricidad</th>
                                <th className="text-center py-4 px-4 text-slate-300 font-semibold text-sm">ABL</th>
                                <th className="text-center py-4 px-4 text-slate-300 font-semibold text-sm">ABL Cochera</th>
                            </tr>
                        </thead>
                        <tbody>
                            {servicesData.map((property, idx) => (
                                <tr key={property.id} className={`border-b border-slate-800 ${idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}>
                                    {/* Property Name */}
                                    <td className="py-4 px-4">
                                        <div className="font-semibold text-white">{property.name}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {property.jurisdiction === 'CABA' ? '🏙️ CABA' : '🌳 Provincia'}
                                        </div>
                                    </td>

                                    {/* Gas */}
                                    <td className="py-4 px-4 text-center">
                                        {property.gasId ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="text-xs text-slate-400">{getGasProvider(property.jurisdiction)}</div>
                                                {property.checks.gas && getStatusBadge(property.checks.gas.status, property.checks.gas.debtAmount)}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>

                                    {/* AYSA */}
                                    <td className="py-4 px-4 text-center">
                                        {property.aysaId ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="text-xs text-slate-400">AYSA</div>
                                                {property.checks.aysa && getStatusBadge(property.checks.aysa.status, property.checks.aysa.debtAmount)}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>

                                    {/* Electricity */}
                                    <td className="py-4 px-4 text-center">
                                        {property.electricityId ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="text-xs text-slate-400">Edenor</div>
                                                {property.checks.electricity && getStatusBadge(property.checks.electricity.status, property.checks.electricity.debtAmount)}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>

                                    {/* ABL */}
                                    <td className="py-4 px-4 text-center">
                                        {property.municipalId ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="text-xs text-slate-400">
                                                    {property.jurisdiction === 'CABA' ? 'ABL CABA' : 'ABL Provincia'}
                                                </div>
                                                {property.checks.municipal && getStatusBadge(property.checks.municipal.status, property.checks.municipal.debtAmount)}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>

                                    {/* ABL Cochera */}
                                    <td className="py-4 px-4 text-center">
                                        {property.hasGarage && property.garageMunicipalId ? (
                                            property.checks.garageMunicipal ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="text-xs text-slate-400">Cochera</div>
                                                    {getStatusBadge(property.checks.garageMunicipal.status, property.checks.garageMunicipal.debtAmount)}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="text-xs text-slate-400">Cochera</div>
                                                    <span className="text-slate-600 text-xs">Sin datos</span>
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-slate-600">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
