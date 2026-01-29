'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Trash2, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import DividendFormModal from './DividendFormModal';

interface Dividend {
    id: string;
    ticker: string;
    companyName: string;
    announcementDate: string;
    paymentDate: string | null;
    amount: number | null;
    currency: string;
    pdfUrl: string | null;
    notes: string | null;
}

interface Summary {
    totalAmount: number;
    totalCount: number;
    thisYearTotal: number;
    thisMonthTotal: number;
    topTicker: {
        ticker: string;
        companyName: string;
        total: number;
        count: number;
    } | null;
}

export default function DividendsTab() {
    const [dividends, setDividends] = useState<Dividend[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTicker, setSearchTicker] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);

    useEffect(() => {
        fetchDividends();
        fetchSummary();
    }, [searchTicker, selectedYear]);

    const fetchDividends = async () => {
        try {
            const params = new URLSearchParams();
            if (searchTicker) params.append('ticker', searchTicker);
            if (selectedYear) params.append('year', selectedYear);

            const response = await fetch(`/api/dividends/cedear?${params}`);
            const data = await response.json();
            setDividends(data);
        } catch (error) {
            console.error('Error fetching dividends:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const params = new URLSearchParams();
            if (selectedYear) params.append('year', selectedYear);

            const response = await fetch(`/api/dividends/cedear/summary?${params}`);
            const data = await response.json();
            setSummary(data.summary);
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este dividendo?')) return;

        try {
            await fetch(`/api/dividends/cedear/${id}`, { method: 'DELETE' });
            fetchDividends();
            fetchSummary();
        } catch (error) {
            console.error('Error deleting dividend:', error);
        }
    };

    const formatCurrency = (amount: number | null, currency: string = 'USD') => {
        if (amount === null) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-AR');
    };

    // Get unique years from dividends
    const years = Array.from(new Set(dividends.map(d =>
        new Date(d.announcementDate).getFullYear().toString()
    ))).sort().reverse();

    if (loading) {
        return <div className="p-8 text-center">Cargando dividendos...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-800/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Total Acumulado</p>
                            <p className="text-2xl font-bold text-blue-400">
                                {formatCurrency(summary?.totalAmount || 0)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{summary?.totalCount || 0} dividendos</p>
                        </div>
                        <DollarSign className="w-8 h-8 text-blue-400/50" />
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-800/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Este Año</p>
                            <p className="text-2xl font-bold text-green-400">
                                {formatCurrency(summary?.thisYearTotal || 0)}
                            </p>
                        </div>
                        <Calendar className="w-8 h-8 text-green-400/50" />
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-800/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Este Mes</p>
                            <p className="text-2xl font-bold text-purple-400">
                                {formatCurrency(summary?.thisMonthTotal || 0)}
                            </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-purple-400/50" />
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-amber-900/20 to-amber-800/10 border-amber-800/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-400">Top Ticker</p>
                            <p className="text-xl font-bold text-amber-400">
                                {summary?.topTicker?.ticker || '-'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {summary?.topTicker ? formatCurrency(summary.topTicker.total) : '-'}
                            </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-amber-400/50" />
                    </div>
                </Card>
            </div>

            {/* Filters and Actions */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-4 flex-1">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <Input
                                type="text"
                                placeholder="Buscar por ticker..."
                                value={searchTicker}
                                onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                                className="pl-10 bg-slate-900/50 border-slate-700 font-mono"
                            />
                        </div>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="px-4 py-2 bg-slate-950 border border-slate-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todos los años</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <Button
                        onClick={() => {
                            setEditingDividend(null);
                            setIsModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Manual
                    </Button>
                </div>
            </Card>

            {/* Dividends Table */}
            <Card className="overflow-hidden bg-slate-900/50 border-slate-800">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Ticker</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Empresa</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha Anuncio</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Fecha Pago</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Monto</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">PDF</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {dividends.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                        No se encontraron dividendos
                                    </td>
                                </tr>
                            ) : (
                                dividends.map((dividend) => (
                                    <tr key={dividend.id} className="hover:bg-slate-900/30 transition-colors">
                                        <td className="px-4 py-3 font-mono font-medium text-blue-400">{dividend.ticker}</td>
                                        <td className="px-4 py-3 text-sm">{dividend.companyName}</td>
                                        <td className="px-4 py-3 text-sm text-slate-400">{formatDate(dividend.announcementDate)}</td>
                                        <td className="px-4 py-3 text-sm text-slate-400">{formatDate(dividend.paymentDate)}</td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {dividend.amount !== null ? (
                                                <span className="text-green-400 font-mono">{formatCurrency(dividend.amount, dividend.currency)}</span>
                                            ) : (
                                                <span className="text-slate-600 italic">Pendiente</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {dividend.pdfUrl && (
                                                <a
                                                    href={dividend.pdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-blue-400 hover:text-blue-300 text-xs font-medium"
                                                >
                                                    <Calendar className="w-3 h-3 mr-1" />
                                                    Ver PDF
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingDividend(dividend);
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDelete(dividend.id)}
                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <DividendFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    fetchDividends();
                    fetchSummary();
                }}
                dividend={editingDividend}
            />
        </div>
    );
}
