'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Flame, RefreshCw, ExternalLink, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Property {
    id: string;
    name: string;
    jurisdiction: 'CABA' | 'PROVINCIA';
    gasId: string | null;
    electricityId: string | null;
}

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

interface PropertyUtilities {
    property: Property;
    checks: {
        gas: UtilityCheck | null;
        electricity: UtilityCheck | null;
    };
}

export function UtilitiesTab({ showValues }: { showValues: boolean }) {
    const [properties, setProperties] = useState<Property[]>([]);
    const [utilities, setUtilities] = useState<Record<string, PropertyUtilities>>({});
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchProperties = async () => {
        try {
            const res = await fetch('/api/rentals/properties');
            const data = await res.json();

            // Filter properties with utility IDs
            const propertiesWithUtilities = data.filter(
                (p: Property) => p.gasId || p.electricityId
            );

            setProperties(propertiesWithUtilities);

            // Fetch utilities for each property
            for (const property of propertiesWithUtilities) {
                await fetchUtilities(property.id);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error fetching properties:', error);
            setLoading(false);
        }
    };

    const fetchUtilities = async (propertyId: string) => {
        try {
            const res = await fetch(`/api/properties/${propertyId}/utilities`);
            const data = await res.json();

            setUtilities(prev => ({
                ...prev,
                [propertyId]: data
            }));
        } catch (error) {
            console.error(`Error fetching utilities for property ${propertyId}:`, error);
        }
    };

    const checkUtility = async (propertyId: string, serviceType: 'GAS' | 'ELECTRICITY') => {
        const key = `${propertyId}-${serviceType}`;
        setChecking(prev => ({ ...prev, [key]: true }));

        try {
            const res = await fetch(`/api/properties/${propertyId}/utilities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceType })
            });

            const data = await res.json();

            if (res.status === 503) {
                alert('⚠️ Verificación manual no disponible en producción\\n\\nEl scraping solo funciona en desarrollo local debido a limitaciones de Vercel.\\n\\nPróximamente: Verificación automática programada.');
                return;
            }

            if (res.ok) {
                await fetchUtilities(propertyId);
            } else {
                alert(`Error: ${data.error || 'No se pudo verificar el servicio'}`);
            }
        } catch (error) {
            console.error('Error checking utility:', error);
            alert('Error de conexión. Por favor intenta de nuevo.');
        } finally {
            setChecking(prev => ({ ...prev, [key]: false }));
        }
    };

    const getStatusBadge = (status: string, debtAmount: number | null) => {
        const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border";

        switch (status) {
            case 'UP_TO_DATE':
                return (
                    <span className={`${baseClasses} bg-emerald-950 text-emerald-400 border-emerald-800`}>
                        <CheckCircle size={14} />
                        Al día
                    </span>
                );
            case 'OVERDUE':
                return (
                    <span className={`${baseClasses} bg-rose-950 text-rose-400 border-rose-800`}>
                        <AlertCircle size={14} />
                        Deuda {debtAmount && showValues ? `$${debtAmount.toLocaleString('es-AR')}` : ''}
                    </span>
                );
            case 'ERROR':
                return (
                    <span className={`${baseClasses} bg-amber-950 text-amber-400 border-amber-800`}>
                        <XCircle size={14} />
                        Error
                    </span>
                );
            default:
                return (
                    <span className={`${baseClasses} bg-slate-800 text-slate-400 border-slate-700`}>
                        <AlertCircle size={14} />
                        Sin verificar
                    </span>
                );
        }
    };

    const getGasProvider = (jurisdiction: 'CABA' | 'PROVINCIA') => {
        return jurisdiction === 'CABA' ? 'Metrogas' : 'Naturgy';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
        );
    }

    if (properties.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400 mb-4">
                    No hay propiedades con servicios configurados.
                </p>
                <p className="text-sm text-slate-500">
                    Agregá los números de cuenta en la pestaña "Propiedades"
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Estado de Servicios</h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Monitoreo automático de Metrogas, Naturgy y Edenor
                    </p>
                </div>
            </div>

            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Propiedad</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Gas</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Electricidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {properties.map(property => {
                                    const propertyUtilities = utilities[property.id];
                                    const gasCheck = propertyUtilities?.checks?.gas;
                                    const electricityCheck = propertyUtilities?.checks?.electricity;
                                    const gasProvider = getGasProvider(property.jurisdiction);

                                    return (
                                        <tr key={property.id} className="border-b border-slate-800 hover:bg-slate-900/50">
                                            {/* Property Name */}
                                            <td className="py-4 px-4">
                                                <div className="font-medium text-white">{property.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {property.jurisdiction === 'CABA' ? '🏙️ CABA' : '🌳 Provincia'}
                                                </div>
                                            </td>

                                            {/* Gas */}
                                            <td className="py-4 px-4">
                                                {property.gasId ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Flame className="text-orange-500" size={18} />
                                                            <span className="text-sm font-medium text-white">{gasProvider}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            {showValues ? property.gasId : '****'}
                                                        </div>
                                                        {gasCheck && (
                                                            <div className="space-y-1.5">
                                                                {getStatusBadge(gasCheck.status, gasCheck.debtAmount)}
                                                                <div className="text-xs text-slate-500">
                                                                    {new Date(gasCheck.checkDate).toLocaleDateString('es-AR')} {new Date(gasCheck.checkDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex gap-1.5 mt-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => checkUtility(property.id, 'GAS')}
                                                                disabled={checking[`${property.id}-GAS`]}
                                                                className="h-7 px-2 border-slate-700 hover:bg-slate-800"
                                                            >
                                                                {checking[`${property.id}-GAS`] ? (
                                                                    <Loader2 className="animate-spin" size={14} />
                                                                ) : (
                                                                    <RefreshCw size={14} />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => window.open(
                                                                    property.jurisdiction === 'CABA'
                                                                        ? 'https://www.metrogas.com.ar/hogares/descarga-y-paga-tu-factura/'
                                                                        : 'https://ov.naturgy.com.ar/Account/BotonDePago',
                                                                    '_blank'
                                                                )}
                                                                className="h-7 px-2 text-slate-400 hover:text-white"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-slate-500">-</span>
                                                )}
                                            </td>

                                            {/* Electricity */}
                                            <td className="py-4 px-4">
                                                {property.electricityId ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Zap className="text-yellow-500" size={18} />
                                                            <span className="text-sm font-medium text-white">Edenor</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            {showValues ? property.electricityId : '****'}
                                                        </div>
                                                        {electricityCheck && (
                                                            <div className="space-y-1.5">
                                                                {getStatusBadge(electricityCheck.status, electricityCheck.debtAmount)}
                                                                <div className="text-xs text-slate-500">
                                                                    {new Date(electricityCheck.checkDate).toLocaleDateString('es-AR')} {new Date(electricityCheck.checkDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex gap-1.5 mt-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => checkUtility(property.id, 'ELECTRICITY')}
                                                                disabled={checking[`${property.id}-ELECTRICITY`]}
                                                                className="h-7 px-2 border-slate-700 hover:bg-slate-800"
                                                            >
                                                                {checking[`${property.id}-ELECTRICITY`] ? (
                                                                    <Loader2 className="animate-spin" size={14} />
                                                                ) : (
                                                                    <RefreshCw size={14} />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => window.open('https://edenordigital.com/ingreso/bienvenida', '_blank')}
                                                                className="h-7 px-2 text-slate-400 hover:text-white"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-slate-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
