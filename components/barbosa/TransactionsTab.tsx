'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Search, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export function TransactionsTab() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'EXPENSE',
        amount: '',
        currency: 'ARS',
        categoryName: '',
        subCategoryName: '',
        description: '',
        exchangeRate: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [txRes, catRes, rateRes] = await Promise.all([
                fetch('/api/barbosa/transactions'),
                fetch('/api/barbosa/categories'),
                fetch('/api/barbosa/exchange-rate')
            ]);

            const transactions = await txRes.json();
            const categories = await catRes.json();
            const rateData = await rateRes.json();

            setTransactions(transactions);
            setCategories(categories);

            // Set default exchange rate if available and not already set manually?
            // Actually, we want to prefill it for new entries. 
            // We'll store it in a default, or update formData if it's currently empty.
            if (rateData.rate) {
                setFormData(prev => ({
                    ...prev,
                    exchangeRate: prev.exchangeRate || rateData.rate.toString()
                }));
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/barbosa/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                // Reset form but keep date/rate/type potentially? No, reset logic.
                setFormData({
                    ...formData,
                    amount: '',
                    description: '',
                    categoryName: '',
                    subCategoryName: ''
                });
                loadData(); // Refresh list and categories
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Derived: Current available subcategories based on typed category
    // For simple UI: List existing categories as datalist options
    const uniqueCategories = Array.from(new Set(categories.filter(c => c.type === formData.type).map(c => c.name)));

    // Find selected category object to show subcategories
    const selectedCategoryObj = categories.find(c => c.name === formData.categoryName && c.type === formData.type);
    const availableSubCategories = selectedCategoryObj ? selectedCategoryObj.subCategories.map((s: any) => s.name) : [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Form */}
            <Card className="bg-slate-900 border-slate-800 lg:col-span-1 h-fit">
                <CardHeader>
                    <CardTitle className="text-white">Nueva Transacción</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Fecha</Label>
                                <Input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="bg-slate-950 border-slate-700 text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Tipo</Label>
                                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="EXPENSE">Gasto</SelectItem>
                                        <SelectItem value="INCOME">Ingreso</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-300">Monto</Label>
                                <div className="relative">
                                    <span className="absolute left-2 top-2.5 text-slate-500">$</span>
                                    <Input
                                        type="number" step="0.01"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="bg-slate-950 border-slate-700 text-white pl-6"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-300">Moneda</Label>
                                <Select value={formData.currency} onValueChange={v => setFormData({ ...formData, currency: v })}>
                                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="ARS">ARS</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Categoría</Label>
                            <Input
                                list="categories-list"
                                value={formData.categoryName}
                                onChange={e => setFormData({ ...formData, categoryName: e.target.value })}
                                className="bg-slate-950 border-slate-700 text-white"
                                placeholder="Escribe o selecciona..."
                                required
                            />
                            <datalist id="categories-list">
                                {uniqueCategories.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Sub Categoría</Label>
                            <Input
                                list="sub-categories-list"
                                value={formData.subCategoryName}
                                onChange={e => setFormData({ ...formData, subCategoryName: e.target.value })}
                                className="bg-slate-950 border-slate-700 text-white"
                                placeholder="Opcional..."
                            />
                            <datalist id="sub-categories-list">
                                {availableSubCategories.map((s: string) => <option key={s} value={s} />)}
                            </datalist>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-300">Descripción</Label>
                            <Input
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="bg-slate-950 border-slate-700 text-white"
                            />
                        </div>

                        {formData.currency === 'ARS' && (
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label className="text-slate-300">Tipo de Cambio (Admin)</Label>
                                </div>
                                <Input
                                    type="number" step="0.01"
                                    value={formData.exchangeRate}
                                    onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })}
                                    className="bg-slate-950 border-slate-700 text-white"
                                    placeholder="Valor del dólar..."
                                />
                                <p className="text-xs text-slate-500">
                                    * Se usará para calcular el monto en USD automáticamente.
                                </p>
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                            <Save className="mr-2 h-4 w-4" /> Guardar
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* List */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Últimos Movimientos</h3>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left text-slate-300">
                        <thead className="bg-slate-900 text-slate-400 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Categoría</th>
                                <th className="px-4 py-3">Sub</th>
                                <th className="px-4 py-3">Desc</th>
                                <th className="px-4 py-3 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 bg-slate-950">
                            {transactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-4 text-center text-slate-500">Sin movimientos</td></tr>
                            ) : transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-900/50">
                                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                                        {format(new Date(tx.date), 'dd/MM/yyyy')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${tx.type === 'INCOME' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                        {tx.category.name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{tx.subCategory?.name || '-'}</td>
                                    <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]">{tx.description}</td>
                                    <td className="px-4 py-3 text-right font-mono font-medium text-white">
                                        {tx.currency === 'USD' ? 'US$' : '$'} {tx.amount.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
