'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { format } from 'date-fns';

interface TreasuryFormProps {
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export function TreasuryForm({ onClose, onSave, initialData }: TreasuryFormProps) {
    const [type, setType] = useState<'TREASURY' | 'ETF'>(initialData?.type || 'TREASURY');
    const [ticker, setTicker] = useState(initialData?.ticker || '');
    const [name, setName] = useState(initialData?.name || '');

    // Treasury Specifics
    const [emissionDate, setEmissionDate] = useState(
        initialData?.emissionDate ? format(new Date(initialData.emissionDate), 'yyyy-MM-dd') : ''
    );
    const [couponRate, setCouponRate] = useState(initialData?.couponRate ? (initialData.couponRate * 100).toString() : '');
    const [frequency, setFrequency] = useState(initialData?.frequency?.toString() || '6');
    const [maturityDate, setMaturityDate] = useState(
        initialData?.maturityDate ? format(new Date(initialData.maturityDate), 'yyyy-MM-dd') : ''
    );
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data: any = {
                ticker: ticker.toUpperCase(),
                name,
                type
            };

            if (type === 'TREASURY') {
                data.emissionDate = emissionDate;
                data.couponRate = parseFloat(couponRate) / 100;
                data.frequency = parseInt(frequency);
                data.maturityDate = maturityDate;
            }

            await onSave(data);
            onClose();
        } catch (error) {
            console.error('Error saving Investment:', error);
            alert('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            {initialData ? 'Editar Activo' : 'Nuevo Activo'}
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-white">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Type Selector (Only for new items or if we want to allow changing type, usually locked on edit but let's allow basic switch if new) */}
                        {!initialData && (
                            <div className="flex gap-4 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setType('TREASURY')}
                                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${type === 'TREASURY' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    Treasury
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('ETF')}
                                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${type === 'ETF' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    ETF
                                </button>
                            </div>
                        )}

                        {/* Ticker y Nombre */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Ticker *
                                </label>
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                    placeholder={type === 'TREASURY' ? "ej: T-10Y" : "ej: SPY"}
                                    required
                                    disabled={!!initialData}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Nombre *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                    placeholder={type === 'TREASURY' ? "ej: US Treasury 10Y" : "ej: S&P 500 ETF"}
                                    required
                                />
                            </div>
                        </div>

                        {type === 'TREASURY' && (
                            <>
                                {/* Fechas */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Fecha de Emisión *
                                        </label>
                                        <input
                                            type="date"
                                            value={emissionDate}
                                            onChange={(e) => setEmissionDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Fecha de Vencimiento *
                                        </label>
                                        <input
                                            type="date"
                                            value={maturityDate}
                                            onChange={(e) => setMaturityDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Tasa y Frecuencia */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Tasa de Interés (% anual) *
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={couponRate}
                                            onChange={(e) => setCouponRate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            placeholder="ej: 4.5"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Frecuencia de Pago (meses) *
                                        </label>
                                        <select
                                            value={frequency}
                                            onChange={(e) => setFrequency(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                            required
                                        >
                                            <option value="6">Semestral</option>
                                            <option value="12">Anual</option>
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                onClick={onClose}
                                variant="outline"
                                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {loading ? 'Guardando...' : 'Guardar Activo'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
