'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface AmortizationScheduleEntry {
    paymentDate: string;
    percentage: string;
}

interface ONFormProps {
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export function ONForm({ onClose, onSave, initialData }: ONFormProps) {
    const [type, setType] = useState(initialData?.type || 'ON');
    const [ticker, setTicker] = useState(initialData?.ticker || '');
    const [name, setName] = useState(initialData?.name || '');
    const [emissionDate, setEmissionDate] = useState(
        initialData?.emissionDate ? format(new Date(initialData.emissionDate), 'yyyy-MM-dd') : ''
    );
    const [couponRate, setCouponRate] = useState(initialData?.couponRate ? (initialData.couponRate * 100).toString() : '');
    const [frequency, setFrequency] = useState(initialData?.frequency?.toString() || '6');
    const [maturityDate, setMaturityDate] = useState(
        initialData?.maturityDate ? format(new Date(initialData.maturityDate), 'yyyy-MM-dd') : ''
    );
    const [amortization, setAmortization] = useState(initialData?.amortization || 'BULLET');
    const [schedules, setSchedules] = useState<AmortizationScheduleEntry[]>(
        initialData?.amortizationSchedules?.map((s: any) => ({
            paymentDate: format(new Date(s.paymentDate), 'yyyy-MM-dd'),
            percentage: (s.percentage * 100).toString()
        })) || []
    );
    const [loading, setLoading] = useState(false);

    const addScheduleRow = () => {
        setSchedules([...schedules, { paymentDate: '', percentage: '' }]);
    };

    const removeScheduleRow = (index: number) => {
        setSchedules(schedules.filter((_, i) => i !== index));
    };

    const updateSchedule = (index: number, field: 'paymentDate' | 'percentage', value: string) => {
        const updated = [...schedules];
        updated[index][field] = value;
        setSchedules(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const isON = type === 'ON';
            const data = {
                type,
                ticker: ticker.toUpperCase(),
                name,
                emissionDate: isON ? emissionDate : null,
                couponRate: isON ? parseFloat(couponRate) / 100 : null,
                frequency: isON ? parseInt(frequency) : null,
                maturityDate: isON ? maturityDate : null,
                amortization: isON ? amortization : null,
                amortizationSchedules: (isON && amortization === 'PERSONALIZADA')
                    ? schedules.map(s => ({
                        paymentDate: s.paymentDate,
                        percentage: parseFloat(s.percentage) / 100
                    }))
                    : undefined
            };

            await onSave(data);
            onClose();
        } catch (error) {
            console.error('Error saving ON:', error);
            alert('Error al guardar la ON');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            {initialData ? 'Editar ON' : 'Nueva ON'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Tipo de Activo */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Tipo de Activo
                            </label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assetType"
                                        value="ON"
                                        checked={type === 'ON'}
                                        onChange={(e) => setType(e.target.value)}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    Obligación Negociable
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assetType"
                                        value="CEDEAR"
                                        checked={type === 'CEDEAR'}
                                        onChange={(e) => setType(e.target.value)}
                                        className="text-purple-600 focus:ring-purple-500"
                                    />
                                    CEDEAR
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="assetType"
                                        value="ETF"
                                        checked={type === 'ETF'}
                                        onChange={(e) => setType(e.target.value)}
                                        className="text-green-600 focus:ring-green-500"
                                    />
                                    ETF (Arg)
                                </label>
                            </div>
                        </div>

                        {/* Ticker y Nombre */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Ticker *
                                </label>
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => setTicker(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                    placeholder={type === 'ON' ? "ej: AL30" : "ej: AAPL"}
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
                                    placeholder={type === 'ON' ? "ej: ALUAR 2030" : "ej: Apple Inc."}
                                    required
                                />
                            </div>
                        </div>

                        {type === 'ON' && (
                            <>
                                {/* Fechas */}
                                <div className="grid grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-2 gap-4">
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
                                            placeholder="ej: 8.5"
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
                                            <option value="1">Mensual</option>
                                            <option value="3">Trimestral</option>
                                            <option value="6">Semestral</option>
                                            <option value="12">Anual</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Tipo de Amortización */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Tipo de Amortización *
                                    </label>
                                    <select
                                        value={amortization}
                                        onChange={(e) => setAmortization(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                                        required
                                    >
                                        <option value="BULLET">Bullet (al vencimiento)</option>
                                        <option value="PERSONALIZADA">Personalizada</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* Schedule de Amortización Personalizada */}
                        {amortization === 'PERSONALIZADA' && (
                            <div className="border border-slate-600 rounded-lg p-4 bg-slate-900/50">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-slate-300">
                                        Cronograma de Amortización
                                    </label>
                                    <Button
                                        type="button"
                                        onClick={addScheduleRow}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Agregar Fecha
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 mb-2">
                                        <div className="col-span-5">Fecha de Pago</div>
                                        <div className="col-span-5">% Capital</div>
                                        <div className="col-span-2"></div>
                                    </div>

                                    {schedules.map((schedule, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2">
                                            <div className="col-span-5">
                                                <input
                                                    type="date"
                                                    value={schedule.paymentDate}
                                                    onChange={(e) => updateSchedule(index, 'paymentDate', e.target.value)}
                                                    className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-5">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={schedule.percentage}
                                                    onChange={(e) => updateSchedule(index, 'percentage', e.target.value)}
                                                    className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                                                    placeholder="%"
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <button
                                                    type="button"
                                                    onClick={() => removeScheduleRow(index)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {schedules.length === 0 && (
                                        <p className="text-sm text-slate-500 text-center py-4">
                                            No hay fechas de amortización definidas
                                        </p>
                                    )}
                                </div>
                            </div>
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
                                {loading ? 'Guardando...' : 'Guardar ON'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
