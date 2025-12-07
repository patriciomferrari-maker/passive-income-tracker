'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, X } from 'lucide-react';

interface Contract {
    id: string;
    tenantName: string | null;
    startDate: string;
    durationMonths: number;
    initialRent: number;
    currency: string;
    adjustmentType: string;
    adjustmentFrequency: number;
    property: {
        id: string;
        name: string;
    };
}

interface Property {
    id: string;
    name: string;
    address: string | null;
}

interface ContractsTabProps {
    showValues?: boolean;
}

export function ContractsTab({ showValues = true }: ContractsTabProps) {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);

    // Form state
    const [propertyId, setPropertyId] = useState('');
    const [tenantName, setTenantName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [durationMonths, setDurationMonths] = useState('12');
    const [initialRent, setInitialRent] = useState('');
    const [currency, setCurrency] = useState('ARS');
    const [adjustmentType, setAdjustmentType] = useState('IPC');
    const [adjustmentFrequency, setAdjustmentFrequency] = useState('12');

    useEffect(() => {
        loadContracts();
        loadProperties();
    }, []);

    const loadContracts = async () => {
        try {
            const res = await fetch('/api/rentals/contracts');
            const data = await res.json();
            if (Array.isArray(data)) {
                setContracts(data);
            } else {
                console.error('API returned non-array:', data);
                setContracts([]);
            }
        } catch (error) {
            console.error('Error loading contracts:', error);
            setContracts([]);
        } finally {
            setLoading(false);
        }
    };

    const loadProperties = async () => {
        try {
            const res = await fetch('/api/rentals/properties');
            const data = await res.json();
            if (Array.isArray(data)) {
                setProperties(data);
            }
        } catch (error) {
            console.error('Error loading properties:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!propertyId) {
            alert('Debe seleccionar una propiedad');
            return;
        }

        try {
            const url = editingContract
                ? `/api/rentals/contracts/${editingContract.id}`
                : '/api/rentals/contracts';

            const method = editingContract ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId,
                    tenantName: tenantName || null,
                    startDate,
                    durationMonths: parseInt(durationMonths),
                    initialRent: parseFloat(initialRent),
                    currency,
                    adjustmentType,
                    adjustmentFrequency: parseInt(adjustmentFrequency)
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Error al guardar contrato');
            }

            await loadContracts();
            resetForm();
            alert(editingContract ? 'Contrato actualizado exitosamente' : 'Contrato creado exitosamente. Cashflows generados automáticamente.');
        } catch (error) {
            console.error('Error saving contract:', error);
            alert(error instanceof Error ? error.message : 'Error al guardar el contrato');
        }
    };

    const handleEdit = (contract: Contract) => {
        setEditingContract(contract);
        setPropertyId(contract.property.id);
        setTenantName(contract.tenantName || '');
        setStartDate(contract.startDate.split('T')[0]);
        setDurationMonths(contract.durationMonths.toString());
        setInitialRent(contract.initialRent.toString());
        setCurrency(contract.currency);
        setAdjustmentType(contract.adjustmentType);
        setAdjustmentFrequency(contract.adjustmentFrequency.toString());
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este contrato? Se eliminarán todos sus cashflows proyectados.')) return;

        try {
            const res = await fetch(`/api/rentals/contracts/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            await loadContracts();
        } catch (error) {
            console.error('Error deleting contract:', error);
            alert('Error al eliminar el contrato');
        }
    };

    const resetForm = () => {
        setPropertyId('');
        setTenantName('');
        setStartDate('');
        setDurationMonths('12');
        setInitialRent('');
        setCurrency('ARS');
        setAdjustmentType('IPC');
        setAdjustmentFrequency('12');
        setEditingContract(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Contratos</h2>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="mr-2" size={16} />
                    Nuevo Contrato
                </Button>
            </div>

            {/* Contracts List */}
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : contracts.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay contratos registrados. Creá uno para empezar.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-3 px-4 text-slate-300">Propiedad</th>
                                        <th className="text-left py-3 px-4 text-slate-300">Inquilino</th>
                                        <th className="text-left py-3 px-4 text-slate-300">Inicio</th>
                                        <th className="text-center py-3 px-4 text-slate-300">Duración</th>
                                        <th className="text-right py-3 px-4 text-slate-300">Monto</th>
                                        <th className="text-center py-3 px-4 text-slate-300">Ajuste</th>
                                        <th className="text-right py-3 px-4 text-slate-300">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contracts.map(contract => (
                                        <tr key={contract.id} className="border-b border-slate-800 hover:bg-slate-900">
                                            <td className="py-3 px-4 text-white font-medium">{contract.property.name}</td>
                                            <td className="py-3 px-4 text-slate-400">{contract.tenantName || '-'}</td>
                                            <td className="py-3 px-4 text-white">
                                                {new Date(contract.startDate).toLocaleDateString('es-AR')}
                                            </td>
                                            <td className="py-3 px-4 text-center text-slate-400">
                                                {contract.durationMonths} meses
                                            </td>
                                            <td className="py-3 px-4 text-right text-emerald-400 font-mono">
                                                {showValues ? `${contract.currency} $${contract.initialRent.toLocaleString()}` : '****'}
                                            </td>
                                            <td className="py-3 px-4 text-center text-slate-400">
                                                {contract.adjustmentType} ({contract.adjustmentFrequency}m)
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(contract)}
                                                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(contract.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="w-full max-w-2xl bg-slate-900 border-slate-700 my-8">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-white">
                                {editingContract ? 'Editar Contrato' : 'Nuevo Contrato'}
                            </CardTitle>
                            <button
                                onClick={resetForm}
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Propiedad *
                                        </label>
                                        <select
                                            required
                                            value={propertyId}
                                            onChange={e => setPropertyId(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        >
                                            <option value="">Seleccionar propiedad...</option>
                                            {properties.map(prop => (
                                                <option key={prop.id} value={prop.id}>
                                                    {prop.name} {prop.address ? `- ${prop.address}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {properties.length === 0 && (
                                            <p className="text-sm text-amber-400 mt-1">
                                                Creá una propiedad primero en la pestaña Propiedades
                                            </p>
                                        )}
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Inquilino
                                        </label>
                                        <input
                                            type="text"
                                            value={tenantName}
                                            onChange={e => setTenantName(e.target.value)}
                                            placeholder="Nombre del inquilino (opcional)"
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Fecha de Inicio *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Duración (meses) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={durationMonths}
                                            onChange={e => setDurationMonths(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Monto Inicial *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={initialRent}
                                            onChange={e => setInitialRent(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Moneda *
                                        </label>
                                        <select
                                            required
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        >
                                            <option value="ARS">ARS (Pesos)</option>
                                            <option value="USD">USD (Dólares)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Tipo de Ajuste *
                                        </label>
                                        <select
                                            required
                                            value={adjustmentType}
                                            onChange={e => setAdjustmentType(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        >
                                            <option value="IPC">IPC (Inflación)</option>
                                            <option value="NONE">Sin Ajuste</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Frecuencia Ajuste (meses) *
                                        </label>
                                        <select
                                            required
                                            value={adjustmentFrequency}
                                            onChange={e => setAdjustmentFrequency(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        >
                                            <option value="3">3 meses</option>
                                            <option value="6">6 meses</option>
                                            <option value="12">12 meses</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button
                                        type="button"
                                        onClick={resetForm}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        {editingContract ? 'Actualizar' : 'Crear'} Contrato
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
