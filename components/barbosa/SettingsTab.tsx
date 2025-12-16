'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ArrowRight } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export function SettingsTab() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Creation Form State
    const [createType, setCreateType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
    const [createLevel, setCreateLevel] = useState<"CATEGORY" | "SUBCATEGORY">("CATEGORY");
    const [newItemName, setNewItemName] = useState("");
    const [selectedParentId, setSelectedParentId] = useState("");

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/barbosa/categories');
            setCategories(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newItemName.trim()) return;

        try {
            if (createLevel === "CATEGORY") {
                await fetch('/api/barbosa/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newItemName, type: createType })
                });
            } else {
                if (!selectedParentId) return; // Must have parent
                await fetch('/api/barbosa/subcategories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoryId: selectedParentId, name: newItemName })
                });
            }
            // Reset and reload
            setNewItemName("");
            loadCategories();
        } catch (e) {
            console.error(e);
        }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm("¿Seguro? Se eliminará la categoría y sus subcategorías.")) return;
        try {
            await fetch(`/api/barbosa/categories?id=${id}`, { method: 'DELETE' });
            loadCategories();
        } catch (e) { console.error(e); }
    };

    const deleteSubCategory = async (id: string) => {
        if (!confirm("¿Eliminar subcategoría?")) return;
        try {
            await fetch(`/api/barbosa/subcategories?id=${id}`, { method: 'DELETE' });
            loadCategories();
        } catch (e) { console.error(e); }
    };

    // Filtered categories for the parent dropdown
    const parentOptions = categories.filter(c => c.type === createType);

    const renderListSection = (title: string, type: "INCOME" | "EXPENSE", colorClass: string) => {
        const list = categories.filter(c => c.type === type);
        return (
            <div className="space-y-4 mb-8">
                <h3 className={`text-lg font-bold ${colorClass} flex items-center gap-2 border-b border-slate-800 pb-2`}>
                    {title}
                </h3>
                <div className="space-y-3">
                    {list.length === 0 && <p className="text-slate-500 text-sm italic">No hay categorías.</p>}
                    {list.map(cat => (
                        <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-white">{cat.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteCategory(cat.id)}
                                    className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 hover:bg-transparent"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Subcategories */}
                            <div className="flex flex-wrap gap-2 pl-2">
                                {cat.subCategories?.length === 0 && <span className="text-xs text-slate-600">Sin subcategorías</span>}
                                {cat.subCategories?.map((sub: any) => (
                                    <Badge key={sub.id} variant="secondary" className="bg-slate-950 text-slate-400 border-slate-700 hover:bg-slate-800 gap-1">
                                        {sub.name}
                                        <div
                                            className="cursor-pointer hover:text-red-400 ml-1"
                                            onClick={(e) => { e.stopPropagation(); deleteSubCategory(sub.id); }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </div>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            {/* Left Column: Creation Form (Botonera) */}
            <div className="lg:col-span-1">
                <Card className="bg-slate-900 border-slate-800 sticky top-4">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Plus className="h-5 w-5 text-blue-500" />
                            Nueva Entrada
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* 1. Select Type */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">¿Qué deseas agregar?</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={createType === 'EXPENSE' ? 'default' : 'outline'}
                                    className={createType === 'EXPENSE' ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}
                                    onClick={() => setCreateType('EXPENSE')}
                                >
                                    Gasto
                                </Button>
                                <Button
                                    type="button"
                                    variant={createType === 'INCOME' ? 'default' : 'outline'}
                                    className={createType === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}
                                    onClick={() => setCreateType('INCOME')}
                                >
                                    Ingreso
                                </Button>
                            </div>
                        </div>

                        {/* 2. Select Level */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Nivel</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={createLevel === 'CATEGORY' ? 'secondary' : 'ghost'}
                                    className={`justify-start ${createLevel === 'CATEGORY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                                    onClick={() => setCreateLevel('CATEGORY')}
                                >
                                    Categoría
                                </Button>
                                <Button
                                    type="button"
                                    variant={createLevel === 'SUBCATEGORY' ? 'secondary' : 'ghost'}
                                    className={`justify-start ${createLevel === 'SUBCATEGORY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                                    onClick={() => setCreateLevel('SUBCATEGORY')}
                                >
                                    Sub-Categoría
                                </Button>
                            </div>
                        </div>

                        {/* 3. Helper for Subcategory: Select Parent */}
                        {createLevel === 'SUBCATEGORY' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-slate-300">Pertenece a la Categoría:</Label>
                                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        {parentOptions.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* 4. Name Input */}
                        <div className="space-y-2">
                            <Label className="text-slate-300">Nombre</Label>
                            <Input
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                className="bg-slate-950 border-slate-700 text-white"
                                placeholder={createLevel === 'CATEGORY' ? "Ej: Supermercado" : "Ej: Comida, Limpieza..."}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                            />
                        </div>

                        <Button
                            type="button"
                            onClick={handleCreate}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                            disabled={!newItemName.trim() || (createLevel === 'SUBCATEGORY' && !selectedParentId)}
                        >
                            Crear {createLevel === 'CATEGORY' ? 'Categoría' : 'Subcategoría'}
                        </Button>

                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Output Lists */}
            <div className="lg:col-span-2 space-y-6 h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                {renderListSection("Ingresos", "INCOME", "text-emerald-400")}
                {renderListSection("Gastos", "EXPENSE", "text-red-400")}
            </div>
        </div>
    );
}
