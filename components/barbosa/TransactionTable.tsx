
import { Checkbox } from "@/components/ui/checkbox";
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ... existing imports

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    type: 'INCOME' | 'EXPENSE';
    categoryId: string;
    subCategoryId?: string;
    isStatistical?: boolean;
    importSource?: string;
    installments?: { current: number; total: number };
}

interface Category {
    id: string;
    name: string;
    subCategories?: { id: string; name: string }[];
}

interface TransactionTableProps {
    transactions: Transaction[];
    categories: Category[];
    selectedIds: string[];
    onSelect: (ids: string[]) => void;
    onEdit: (tx: Transaction) => void;
    onDelete: (id: string) => void;
}

export function TransactionTable({ transactions, categories, selectedIds, onSelect, onEdit, onDelete }: TransactionTableProps) {
    // Helper to get category name
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Sin Categoría';
    const getSubCategoryName = (catId: string, subId?: string) => {
        if (!subId) return null;
        const cat = categories.find(c => c.id === catId);
        return cat?.subCategories?.find(s => s.id === subId)?.name;
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            onSelect(transactions.map(t => t.id));
        } else {
            onSelect([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            onSelect([...selectedIds, id]);
        } else {
            onSelect(selectedIds.filter(i => i !== id));
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                    <tr>
                        <th className="px-4 py-3 w-[40px]">
                            <Checkbox
                                checked={transactions.length > 0 && transactions.every(t => selectedIds.includes(t.id))}
                                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                            />
                        </th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {transactions.map((tx) => (
                        <tr key={tx.id} className={`hover:bg-slate-800/50 transition-colors group ${selectedIds.includes(tx.id) ? 'bg-indigo-900/20' : ''}`}>
                            <td className="px-4 py-3">
                                <Checkbox
                                    checked={selectedIds.includes(tx.id)}
                                    onCheckedChange={(checked) => handleSelectOne(tx.id, checked as boolean)}
                                />
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                                {format(new Date(tx.date), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-3">
                                <div className="font-medium text-white">{tx.description}</div>
                                <div className="flex gap-2 mt-1">
                                    {tx.installments && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-indigo-950/30 border-indigo-700 text-indigo-300">
                                            Cuota {tx.installments.current}/{tx.installments.total}
                                        </Badge>
                                    )}
                                    {tx.isStatistical && (
                                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-950/30 border-blue-700 text-blue-300">
                                            Estadístico
                                        </Badge>
                                    )}
                                    {tx.importSource && tx.importSource !== 'MANUAL' && (
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-slate-800 text-slate-400">
                                            {tx.importSource}
                                        </Badge>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="text-slate-200">{getCategoryName(tx.categoryId)}</div>
                                {tx.subCategoryId && (
                                    <div className="text-xs text-slate-500">
                                        ↳ {getSubCategoryName(tx.categoryId, tx.subCategoryId)}
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <span className={`font-mono font-bold ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'}`}>
                                    {tx.type === 'INCOME' ? '+' : '-'}
                                    {tx.currency} {tx.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2 text-opacity-100">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700" onClick={() => onEdit(tx)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-900/20" onClick={() => onDelete(tx.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
