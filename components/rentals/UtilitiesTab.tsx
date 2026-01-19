'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Flame, RefreshCw, ExternalLink, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Property {
    id: string;
    name: string;
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
                // Production scraping disabled
                alert('⚠️ Verificación manual no disponible en producción\n\nEl scraping solo funciona en desarrollo local debido a limitaciones de Vercel.\n\nPróximamente: Verificación automática programada.');
                return;
            }

            if (res.ok) {
                // Refresh utilities for this property
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'UP_TO_DATE':
                return <CheckCircle className="text-emerald-500" size={20} />;
            case 'OVERDUE':
                return <AlertCircle className="text-rose-500" size={20} />;
            case 'ERROR':
                return <XCircle className="text-amber-500" size={20} />;
            default:
                return <AlertCircle className="text-slate-500" size={20} />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'UP_TO_DATE':
                return 'Al día';
            case 'OVERDUE':
                return 'Deuda';
            case 'ERROR':
                return 'Error';
            default:
                return 'Sin verificar';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'UP_TO_DATE':
                return 'bg-emerald-950 text-emerald-400 border-emerald-800';
            case 'OVERDUE':
                return 'bg-rose-950 text-rose-400 border-rose-800';
            case 'ERROR':
                return 'bg-amber-950 text-amber-400 border-amber-800';
            default:
                return 'bg-slate-800 text-slate-400 border-slate-700';
        }
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
                        Monitoreo automático de Metrogas y Edenor
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {properties.map(property => {
                    const propertyUtilities = utilities[property.id];
                    const gasCheck = propertyUtilities?.checks?.gas;
                    const electricityCheck = propertyUtilities?.checks?.electricity;

                    return (
                        <Card key={property.id} className="bg-slate-950 border-slate-800">
                            <CardHeader className="border-b border-slate-800/50">
                                <CardTitle className="text-white flex items-center gap-2">
                                    {property.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {/* Metrogas */}
                                {property.gasId && (
                                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Flame className="text-orange-500" size={24} />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white">Metrogas</span>
                                                    {gasCheck && getStatusIcon(gasCheck.status)}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {showValues ? property.gasId : '****'}
                                                </p>
                                                {gasCheck && (
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(gasCheck.status)}`}>
                                                                {getStatusText(gasCheck.status)}
                                                            </span>
                                                            {gasCheck.debtAmount && gasCheck.debtAmount > 0 && showValues && (
                                                                <span className="text-sm font-mono text-rose-400">
                                                                    ${gasCheck.debtAmount.toLocaleString('es-AR')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500">
                                                            Último check: {new Date(gasCheck.checkDate).toLocaleDateString('es-AR')} {new Date(gasCheck.checkDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => checkUtility(property.id, 'GAS')}
                                                disabled={checking[`${property.id}-GAS`]}
                                                className="border-slate-700 hover:bg-slate-800"
                                            >
                                                {checking[`${property.id}-GAS`] ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <RefreshCw size={16} />
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => window.open('https://www.metrogas.com.ar/hogares/descarga-y-paga-tu-factura/', '_blank')}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                <ExternalLink size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Edenor */}
                                {property.electricityId && (
                                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Zap className="text-yellow-500" size={24} />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-white">Edenor</span>
                                                    {electricityCheck && getStatusIcon(electricityCheck.status)}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {showValues ? property.electricityId : '****'}
                                                </p>
                                                {electricityCheck && (
                                                    <div className="mt-2 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(electricityCheck.status)}`}>
                                                                {getStatusText(electricityCheck.status)}
                                                            </span>
                                                            {electricityCheck.debtAmount && electricityCheck.debtAmount > 0 && showValues && (
                                                                <span className="text-sm font-mono text-rose-400">
                                                                    ${electricityCheck.debtAmount.toLocaleString('es-AR')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500">
                                                            Último check: {new Date(electricityCheck.checkDate).toLocaleDateString('es-AR')} {new Date(electricityCheck.checkDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => checkUtility(property.id, 'ELECTRICITY')}
                                                disabled={checking[`${property.id}-ELECTRICITY`]}
                                                className="border-slate-700 hover:bg-slate-800"
                                            >
                                                {checking[`${property.id}-ELECTRICITY`] ? (
                                                    <Loader2 className="animate-spin" size={16} />
                                                ) : (
                                                    <RefreshCw size={16} />
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => window.open('https://edenordigital.com/ingreso/bienvenida', '_blank')}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                <ExternalLink size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
