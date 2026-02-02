'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ArrowRight, DollarSign, ListTree } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SettingsTab() {
    const [categories, setCategories] = useState<any[]>([]);
    const [dollarSources, setDollarSources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Creation Form State
    const [createType, setCreateType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
    const [createLevel, setCreateLevel] = useState<"CATEGORY" | "SUBCATEGORY">("CATEGORY");
    const [newItemName, setNewItemName] = useState("");
    const [selectedParentId, setSelectedParentId] = useState("");

    // Dollar Source State
    const [newSourceName, setNewSourceName] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [catRes, sourceRes] = await Promise.all([
                fetch('/api/barbosa/categories'),
                fetch('/api/hogar/sources')
            ]);

            const catData = await catRes.json();
            const sourceData = await sourceRes.json();

            setCategories(Array.isArray(catData) ? catData : []);
            setDollarSources(Array.isArray(sourceData) ? sourceData : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- Category Logic ---
    const handleCreateCategory = async () => {
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
            setNewItemName("");
            loadData();
        } catch (e) { console.error(e); }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm("¿Seguro? Se eliminará la categoría y sus subcategorías.")) return;
        try {
            await fetch(`/api/barbosa/categories?id=${id}`, { method: 'DELETE' });
            loadData();
        } catch (e) { console.error(e); }
    };

    const deleteSubCategory = async (id: string) => {
        if (!confirm("¿Eliminar subcategoría?")) return;
        try {
            await fetch(`/api/barbosa/subcategories?id=${id}`, { method: 'DELETE' });
            loadData();
        } catch (e) { console.error(e); }
    };

    // --- Dollar Source Logic ---
    const handleCreateSource = async () => {
        if (!newSourceName.trim()) return;
        try {
            await fetch('/api/hogar/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSourceName })
            });
            setNewSourceName("");
            loadData();
        } catch (e) { console.error(e); }
    };

    const deleteSource = async (id: string) => {
        if (!confirm("¿Eliminar fuente de dólares?")) return;
        try {
            await fetch(`/api/hogar/sources?id=${id}`, { method: 'DELETE' });
            loadData();
        } catch (e) { console.error(e); }
    };


    const parentOptions = categories.filter(c => c.type === createType);

    const renderCategoryList = (title: string, type: "INCOME" | "EXPENSE", colorClass: string) => {
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
        <div className="h-full">
            <Tabs defaultValue="categories" className="h-full space-y-6">
                <TabsList className="bg-slate-900 border border-slate-800">
                    <TabsTrigger value="categories" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        <ListTree className="h-4 w-4 mr-2" /> Categorías Generales
                    </TabsTrigger>
                    <TabsTrigger value="dollars" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        <DollarSign className="h-4 w-4 mr-2" /> Fuentes Dólares
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="m-0 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                        {/* Creation Form */}
                        <div className="lg:col-span-1">
                            <Card className="bg-slate-900 border-slate-800 sticky top-4">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <Plus className="h-5 w-5 text-blue-500" />
                                        Nueva Categoría
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Tipo</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant={createType === 'EXPENSE' ? 'default' : 'outline'}
                                                className={createType === 'EXPENSE' ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}
                                                onClick={() => setCreateType('EXPENSE')}
                                            >
                                                Gasto
                                            </Button>
                                            <Button
                                                variant={createType === 'INCOME' ? 'default' : 'outline'}
                                                className={createType === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'}
                                                onClick={() => setCreateType('INCOME')}
                                            >
                                                Ingreso
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Nivel</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                variant={createLevel === 'CATEGORY' ? 'secondary' : 'ghost'}
                                                className={`justify-start ${createLevel === 'CATEGORY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                                                onClick={() => setCreateLevel('CATEGORY')}
                                            >
                                                Categoría
                                            </Button>
                                            <Button
                                                variant={createLevel === 'SUBCATEGORY' ? 'secondary' : 'ghost'}
                                                className={`justify-start ${createLevel === 'SUBCATEGORY' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                                                onClick={() => setCreateLevel('SUBCATEGORY')}
                                            >
                                                Sub-Categoría
                                            </Button>
                                        </div>
                                    </div>

                                    {createLevel === 'SUBCATEGORY' && (
                                        <div className="space-y-2 animate-in fade-in">
                                            <Label className="text-slate-300">Categoría Padre</Label>
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

                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Nombre</Label>
                                        <Input
                                            value={newItemName}
                                            onChange={e => setNewItemName(e.target.value)}
                                            className="bg-slate-950 border-slate-700 text-white"
                                            onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); }}
                                        />
                                    </div>

                                    <Button
                                        onClick={handleCreateCategory}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4"
                                        disabled={!newItemName.trim() || (createLevel === 'SUBCATEGORY' && !selectedParentId)}
                                    >
                                        Crear
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* List */}
                        <div className="lg:col-span-2 space-y-6 h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                            {renderCategoryList("Ingresos", "INCOME", "text-emerald-400")}
                            {renderCategoryList("Gastos", "EXPENSE", "text-red-400")}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="dollars" className="m-0 h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                        {/* Creation Form */}
                        <div className="lg:col-span-1">
                            <Card className="bg-slate-900 border-slate-800 sticky top-4">
                                <CardHeader>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <DollarSign className="h-5 w-5 text-emerald-500" />
                                        Nueva Fuente de Dólares
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <p className="text-sm text-slate-400">
                                        Define aquí los orígenes de tus compras de dólares (ej: Sueldo, Aguinaldo, Venta Auto).
                                    </p>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Nombre de la Fuente</Label>
                                        <Input
                                            value={newSourceName}
                                            onChange={e => setNewSourceName(e.target.value)}
                                            className="bg-slate-950 border-slate-700 text-white"
                                            placeholder="Ej: Sueldo Pato"
                                            onKeyDown={e => { if (e.key === 'Enter') handleCreateSource(); }}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleCreateSource}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                                        disabled={!newSourceName.trim()}
                                    >
                                        Agregar Fuente
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* List */}
                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2 mb-4">
                                Fuentes Activas
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {dollarSources.length === 0 && <p className="text-slate-500 italic">No hay fuentes definidas.</p>}
                                {dollarSources.map(src => (
                                    <Card key={src.id} className="bg-slate-900 border-slate-800 group hover:border-slate-700 transition-colors">
                                        <CardContent className="flex items-center justify-between p-4">
                                            <span className="font-medium text-white">{src.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteSource(src.id)}
                                                className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
