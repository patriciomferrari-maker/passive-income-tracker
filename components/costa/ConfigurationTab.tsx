import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ConfigurationTab() {
    const [categories, setCategories] = useState<any[]>([]);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('EXPENSE');

    const loadCategories = async () => {
        const res = await fetch('/api/costa/categories');
        if (res.ok) setCategories(await res.json());
    };

    useEffect(() => { loadCategories(); }, []);

    const handleAdd = async () => {
        if (!newName) return;
        await fetch('/api/costa/categories', {
            method: 'POST',
            body: JSON.stringify({ name: newName, type: newType })
        });
        setNewName('');
        loadCategories();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Eliminar categoría?')) {
            await fetch(`/api/costa/categories?id=${id}`, { method: 'DELETE' });
            loadCategories();
        }
    };

    return (
        <Card className="bg-slate-900 border-slate-800">
            <CardHeader><CardTitle className="text-white">Categorías de Gastos e Ingresos</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-4 items-end">
                    <div className="space-y-2 flex-1">
                        <Label className="text-white font-bold">Nombre</Label>
                        <Input value={newName} onChange={e => setNewName(e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" placeholder="Ej. Jardinería" />
                    </div>
                    <div className="space-y-2 w-40">
                        <Label className="text-white font-bold">Tipo</Label>
                        <Select value={newType} onValueChange={setNewType}>
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-700 text-white z-50">
                                <SelectItem value="EXPENSE" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Gasto</SelectItem>
                                <SelectItem value="INCOME" className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white">Ingreso</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white">Agregar</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Expenses List */}
                    <div>
                        <h3 className="text-red-400 font-bold mb-3 border-b border-red-900/50 pb-2">Gastos</h3>
                        <div className="space-y-2">
                            {categories.filter(c => c.type === 'EXPENSE').map(c => (
                                <div key={c.id} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800 shadow-sm transition-colors hover:border-slate-700">
                                    <span className="text-slate-200 font-medium">{c.name}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-slate-500 hover:text-red-400 hover:bg-red-950/30 h-8 w-8"><Trash2 size={16} /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Income List */}
                    <div>
                        <h3 className="text-emerald-400 font-bold mb-3 border-b border-emerald-900/50 pb-2">Ingresos</h3>
                        <div className="space-y-2">
                            {categories.filter(c => c.type === 'INCOME').map(c => (
                                <div key={c.id} className="flex justify-between items-center p-3 bg-slate-950 rounded border border-slate-800 shadow-sm transition-colors hover:border-slate-700">
                                    <span className="text-slate-200 font-medium">{c.name}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-slate-500 hover:text-red-400 hover:bg-red-950/30 h-8 w-8"><Trash2 size={16} /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
