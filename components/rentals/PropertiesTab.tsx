'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface Property {
    id: string;
    name: string;
    address: string | null;
    electricityId: string | null;
    gasId: string | null;
    municipalId: string | null;
    hasGarage: boolean;
    garageMunicipalId: string | null;
    _count: {
        contracts: number;
    };
}

interface PropertiesTabProps {
    showValues?: boolean;
}

export function PropertiesTab({ showValues = true }: PropertiesTabProps) {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingProperty, setEditingProperty] = useState<Property | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [electricityId, setElectricityId] = useState('');
    const [gasId, setGasId] = useState('');
    const [municipalId, setMunicipalId] = useState('');
    const [hasGarage, setHasGarage] = useState(false);
    const [garageMunicipalId, setGarageMunicipalId] = useState('');

    useEffect(() => {
        loadProperties();
    }, []);

    const loadProperties = async () => {
        try {
            const res = await fetch('/api/rentals/properties');
            const data = await res.json();
            setProperties(data);
        } catch (error) {
            console.error('Error loading properties:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const url = editingProperty
                ? `/api/rentals/properties/${editingProperty.id}`
                : '/api/rentals/properties';

            const method = editingProperty ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    address,
                    electricityId: electricityId || null,
                    gasId: gasId || null,
                    municipalId: municipalId || null,
                    hasGarage,
                    garageMunicipalId: garageMunicipalId || null
                })
            });

            if (!res.ok) throw new Error('Failed to save property');

            await loadProperties();
            resetForm();
        } catch (error) {
            console.error('Error saving property:', error);
            alert('Error al guardar la propiedad');
        }
    };

    const handleEdit = (property: Property) => {
        setEditingProperty(property);
        setName(property.name);
        setAddress(property.address || '');
        setElectricityId(property.electricityId || '');
        setGasId(property.gasId || '');
        setMunicipalId(property.municipalId || '');
        setHasGarage(property.hasGarage || false);
        setGarageMunicipalId(property.garageMunicipalId || '');
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta propiedad? Se eliminarán todos sus contratos.')) return;

        try {
            const res = await fetch(`/api/rentals/properties/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            await loadProperties();
        } catch (error) {
            console.error('Error deleting property:', error);
            alert('Error al eliminar la propiedad');
        }
    };

    const resetForm = () => {
        setName('');
        setAddress('');
        setElectricityId('');
        setGasId('');
        setMunicipalId('');
        setHasGarage(false);
        setGarageMunicipalId('');
        setEditingProperty(null);
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Propiedades</h2>
                <Button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="mr-2" size={16} />
                    Nueva Propiedad
                </Button>
            </div>

            {/* Properties List */}
            <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="text-slate-400 text-center py-12">Cargando...</div>
                    ) : properties.length === 0 ? (
                        <div className="text-slate-400 text-center py-12">
                            No hay propiedades registradas.
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Nombre</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Dirección</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">ID Municipal</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">ID Cochera</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">ID Luz</th>
                                    <th className="text-left py-3 px-4 text-slate-300 font-medium">ID Gas</th>
                                    <th className="text-center py-3 px-4 text-slate-300 font-medium">Contratos</th>
                                    <th className="text-right py-3 px-4 text-slate-300 font-medium">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {properties.map(property => (
                                    <tr key={property.id} className="border-b border-slate-800 hover:bg-slate-900">
                                        <td className="py-3 px-4 text-white font-medium">{property.name}</td>
                                        <td className="py-3 px-4 text-slate-400">{property.address || '-'}</td>
                                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{property.municipalId || '-'}</td>
                                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{property.garageMunicipalId || '-'}</td>
                                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{property.electricityId || '-'}</td>
                                        <td className="py-3 px-4 text-slate-400 font-mono text-xs">{property.gasId || '-'}</td>
                                        <td className="py-3 px-4 text-center text-white">{property._count.contracts}</td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(property)}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(property.id)}
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
                    )}
                </CardContent>
            </Card>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">
                                {editingProperty ? 'Editar Propiedad' : 'Nueva Propiedad'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        Dirección
                                    </label>
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">ID Luz</label>
                                        <input
                                            type="text"
                                            value={electricityId}
                                            onChange={e => setElectricityId(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">ID Gas</label>
                                        <input
                                            type="text"
                                            value={gasId}
                                            onChange={e => setGasId(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">ID Municipal</label>
                                        <input
                                            type="text"
                                            value={municipalId}
                                            onChange={e => setMunicipalId(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="checkbox"
                                            id="hasGarage"
                                            checked={hasGarage}
                                            onChange={e => setHasGarage(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor="hasGarage" className="text-sm font-medium text-slate-300 select-none cursor-pointer">
                                            Incluye Cochera
                                        </label>
                                    </div>

                                    {hasGarage && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">ID Municipal Cochera</label>
                                            <input
                                                type="text"
                                                value={garageMunicipalId}
                                                onChange={e => setGarageMunicipalId(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                                            />
                                        </div>
                                    )}
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
                                        Guardar
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
