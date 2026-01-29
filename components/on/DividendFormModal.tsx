'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Dividend {
    id: string;
    ticker: string;
    companyName: string;
    announcementDate: string;
    paymentDate: string | null;
    recordDate: string | null;
    exDate: string | null;
    amount: number | null;
    currency: string;
    pdfUrl: string | null;
    notes: string | null;
}

interface DividendFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    dividend: Dividend | null; // Null means create new
}

export default function DividendFormModal({ isOpen, onClose, onSuccess, dividend }: DividendFormModalProps) {
    const [loading, setLoading] = useState(false);
    const [availableTickers, setAvailableTickers] = useState<Array<{ ticker: string, name: string }>>([]);
    const [formData, setFormData] = useState({
        ticker: '',
        companyName: '',
        announcementDate: '',
        paymentDate: '',
        amount: '',
        currency: 'USD',
        notes: '',
        pdfUrl: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchTickers();
        }
    }, [isOpen]);

    const fetchTickers = async () => {
        try {
            const res = await fetch('/api/investments/my-tickers');
            if (res.ok) {
                const data = await res.json();
                setAvailableTickers(data);
            }
        } catch (error) {
            console.error('Error fetching tickers:', error);
        }
    };

    useEffect(() => {
        if (dividend) {
            setFormData({
                ticker: dividend.ticker,
                companyName: dividend.companyName,
                announcementDate: dividend.announcementDate.split('T')[0],
                paymentDate: dividend.paymentDate ? dividend.paymentDate.split('T')[0] : '',
                amount: dividend.amount?.toString() || '',
                currency: dividend.currency,
                notes: dividend.notes || '',
                pdfUrl: dividend.pdfUrl || ''
            });
        } else {
            setFormData({
                ticker: '',
                companyName: '',
                announcementDate: new Date().toISOString().split('T')[0],
                paymentDate: '',
                amount: '',
                currency: 'USD',
                notes: '',
                pdfUrl: ''
            });
        }
    }, [dividend, isOpen]);

    const handleTickerChange = (value: string) => {
        const uppercaseValue = value.toUpperCase();
        const found = availableTickers.find(t => t.ticker === uppercaseValue);

        setFormData(prev => ({
            ...prev,
            ticker: uppercaseValue,
            companyName: found ? found.name : prev.companyName
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const url = dividend
                ? `/api/dividends/cedear/${dividend.id}`
                : '/api/dividends/cedear';

            const method = dividend ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    amount: formData.amount ? parseFloat(formData.amount) : null
                }),
            });

            if (response.ok) {
                onSuccess();
                onClose();
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Error al guardar el dividendo');
            }
        } catch (error) {
            console.error('Error saving dividend:', error);
            alert('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>{dividend ? 'Editar Dividendo' : 'Nuevo Dividendo'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="ticker">Ticker</Label>
                                <Input
                                    id="ticker"
                                    list="tickers-list"
                                    value={formData.ticker}
                                    onChange={(e) => handleTickerChange(e.target.value)}
                                    placeholder="AAPL"
                                    required
                                    className="bg-slate-950 border-slate-800"
                                />
                                <datalist id="tickers-list">
                                    {availableTickers.map(t => (
                                        <option key={t.ticker} value={t.ticker}>
                                            {t.name}
                                        </option>
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Empresa</Label>
                                <Input
                                    id="companyName"
                                    value={formData.companyName}
                                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    placeholder="Apple Inc."
                                    required
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="announcementDate">Fecha Anuncio</Label>
                                <Input
                                    id="announcementDate"
                                    type="date"
                                    value={formData.announcementDate}
                                    onChange={(e) => setFormData({ ...formData, announcementDate: e.target.value })}
                                    required
                                    className="bg-slate-950 border-slate-800 [color-scheme:dark]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentDate">Fecha Pago (opcional)</Label>
                                <Input
                                    id="paymentDate"
                                    type="date"
                                    value={formData.paymentDate}
                                    onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                                    className="bg-slate-950 border-slate-800 [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Monto (USD)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    step="0.00000001"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.25"
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Moneda</Label>
                                <select
                                    id="currency"
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-sm"
                                >
                                    <option value="USD">USD</option>
                                    <option value="ARS">ARS</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pdfUrl">URL del PDF (opcional)</Label>
                            <Input
                                id="pdfUrl"
                                type="url"
                                value={formData.pdfUrl}
                                onChange={(e) => setFormData({ ...formData, pdfUrl: e.target.value })}
                                placeholder="https://www.comafi.com.ar/..."
                                className="bg-slate-950 border-slate-800"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notas</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Información adicional sobre el pago..."
                                className="bg-slate-950 border-slate-800 h-20"
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
