'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export function SettingsTab() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // New Category State
    const [newCatName, setNewCatName] = useState("");
    const [newCatType, setNewCatType] = useState("EXPENSE");

    // New SubCategory State (Map by categoryId)
    const [newSubCats, setNewSubCats] = useState<Record<string, string>>({});

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

    const addCategory = async () => {
        if (!newCatName.trim()) return;
        try {
            await fetch('/api/barbosa/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCatName, type: newCatType })
            });
            setNewCatName("");
            loadCategories();
        } catch (e) { console.error(e); }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm("¿Seguro? Se eliminará la categoría.")) return;
        try {
            await fetch(`/api/barbosa/categories?id=${id}`, { method: 'DELETE' });
            loadCategories();
        } catch (e) { console.error(e); }
    };

    const addSubCategory = async (categoryId: string) => {
        const name = newSubCats[categoryId];
        if (!name?.trim()) return;

        try {
            await fetch('/api/barbosa/subcategories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryId, name })
            });
            setNewSubCats({ ...newSubCats, [categoryId]: "" });
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

    const renderCategoryList = (type: string) => {
        const list = categories.filter(c => c.type === type);
        return (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder={`Nueva categoría de ${type === 'INCOME' ? 'Ingreso' : 'Gasto'}...`}
                        value={newCatType === type ? newCatName : ""}
                        onChange={e => {
                            setNewCatType(type);
                            setNewCatName(e.target.value);
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
                        className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    <Button
                        type="button"
                        onClick={addCategory}
                        size="sm"
                        variant="secondary"
                        disabled={loading || (newCatType === type && !newCatName.trim())}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-2">
                    {list.map(cat => (
                        <Card key={cat.id} className="bg-slate-900 border-slate-800">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-white">{cat.name}</h4>
                                    <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-300 hover:bg-slate-800">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="pl-4 border-l-2 border-slate-800 space-y-2">
                                    {/* SubCategories List */}
                                    <div className="flex flex-wrap gap-2">
                                        {cat.subCategories?.map((sub: any) => (
                                            <Badge key={sub.id} variant="outline" className="text-slate-400 border-slate-700 bg-slate-950 gap-1 pr-1">
                                                {sub.name}
                                                <div
                                                    className="cursor-pointer hover:text-red-400 p-0.5 rounded-full"
                                                    onClick={() => deleteSubCategory(sub.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </div>
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Add Sub Input */}
                                    <div className="flex gap-2 mt-2">
                                        <Input
                                            placeholder="+ Subcategoría"
                                            className="h-7 text-xs bg-slate-950 border-slate-700 text-slate-300 placeholder:text-slate-600 w-40"
                                            value={newSubCats[cat.id] || ""}
                                            onChange={e => setNewSubCats({ ...newSubCats, [cat.id]: e.target.value })}
                                            onKeyDown={e => { if (e.key === 'Enter') addSubCategory(cat.id); }}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 hover:bg-slate-800 text-slate-400 hover:text-white"
                                            onClick={() => addSubCategory(cat.id)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                    Ingresos
                </h3>
                {renderCategoryList('INCOME')}
            </div>
            <div>
                <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                    Gastos
                </h3>
                {renderCategoryList('EXPENSE')}
            </div>
        </div>
    );
}
