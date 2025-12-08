'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle, CheckCircle, Eye } from 'lucide-react';

interface ImportRow {
    ticker: string;
    fecha: string;
    nominales: number;
    precio: number;
    comision: number;
}

interface ImportResult {
    success: number;
    errors: Array<{ row: number; error: string }>;
}

export function BulkImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [preview, setPreview] = useState<ImportRow[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setResult(null);

            try {
                const text = await selectedFile.text();
                const rows = parseCSV(text);
                setPreview(rows);
                setShowPreview(true);
            } catch (error) {
                console.error('Error parsing file:', error);
                alert('Error al leer el archivo');
            }
        }
    };

    const parseCSV = (text: string): ImportRow[] => {
        const lines = text.split('\n').filter(line => line.trim());
        const rows: ImportRow[] = [];

        // Helper to parse CSV line with quoted values
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        // Helper to parse number (handles 1.000,00 and 1000.00)
        const parseNumber = (value: string): number => {
            value = value.replace(/"/g, '').trim();

            // European format: 1.000,00
            if (value.includes(',')) {
                value = value.replace(/\./g, '').replace(',', '.');
            }

            return parseFloat(value) || 0;
        };

        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);

            if (values.length >= 4) {
                // Parse date
                const dateStr = values[1].replace(/"/g, '').trim();
                const dateParts = dateStr.split(/[/-]/);
                let isoDate: string;

                if (dateParts.length === 3) {
                    const day = dateParts[0].padStart(2, '0');
                    const month = dateParts[1].padStart(2, '0');
                    const year = dateParts[2];
                    isoDate = `${year}-${month}-${day}`;
                } else {
                    isoDate = dateStr;
                }

                rows.push({
                    ticker: values[0].replace(/"/g, '').trim().toUpperCase(),
                    fecha: isoDate,
                    nominales: parseNumber(values[2]),
                    precio: parseNumber(values[3]),
                    comision: values.length >= 5 ? parseNumber(values[4]) : 0
                });
            }
        }

        return rows;
    };

    const handleImport = async () => {
        if (!file || preview.length === 0) return;

        setImporting(true);
        setResult(null);

        try {
            const onsRes = await fetch('/api/investments/on');
            const ons = await onsRes.json();
            const tickerMap = new Map(ons.map((on: any) => [on.ticker, on.id]));

            let success = 0;
            const errors: Array<{ row: number; error: string }> = [];

            for (let i = 0; i < preview.length; i++) {
                const row = preview[i];
                const investmentId = tickerMap.get(row.ticker);

                if (!investmentId) {
                    errors.push({ row: i + 2, error: `Ticker ${row.ticker} no encontrado` });
                    continue;
                }

                try {
                    const res = await fetch(`/api/investments/on/${investmentId}/transactions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            date: row.fecha,
                            quantity: row.nominales,
                            price: row.precio,
                            commission: row.comision
                        })
                    });

                    if (!res.ok) {
                        const errorData = await res.json();
                        errors.push({ row: i + 2, error: errorData.error || 'Error al crear transacción' });
                    } else {
                        success++;
                    }
                } catch (error) {
                    errors.push({ row: i + 2, error: 'Error de red' });
                }
            }

            setResult({ success, errors });
            setShowPreview(false);
            if (success > 0) {
                onSuccess();
            }
        } catch (error) {
            console.error('Error importing file:', error);
            alert('Error al procesar el archivo');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Importar Compras Masivamente
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                        Sube un archivo CSV con las compras realizadas
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Instructions */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h3 className="text-blue-300 font-medium mb-2">Formato del archivo CSV:</h3>
                        <code className="text-xs text-slate-300 block bg-slate-900 p-2 rounded">
                            Ticker,Fecha Compra,Cantidad,Precio Compra,Comision<br />
                            "DNCSD","04/08/2025","5.000,00","1,0400","5,03400"<br />
                            "VSCRO","16/04/2025","357,00","1,0210","0,35300"
                        </code>
                        <p className="text-xs text-slate-400 mt-2">
                            • La fecha debe estar en formato dd/mm/yyyy<br />
                            • Los números pueden usar punto como separador de miles y coma como decimal<br />
                            • Los valores pueden estar entre comillas<br />
                            • Los tickers deben estar previamente configurados<br />
                            • La comisión es opcional (por defecto 0)
                        </p>
                    </div>

                    {/* File Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Seleccionar archivo CSV
                        </label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                    </div>

                    {/* Preview */}
                    {showPreview && preview.length > 0 && (
                        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Eye className="h-5 w-5 text-blue-400" />
                                <h3 className="text-white font-medium">Previsualización ({preview.length} filas)</h3>
                            </div>
                            <div className="overflow-x-auto max-h-64">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-600">
                                            <th className="text-left py-2 px-2 text-slate-300">Ticker</th>
                                            <th className="text-left py-2 px-2 text-slate-300">Fecha</th>
                                            <th className="text-right py-2 px-2 text-slate-300">Nominales</th>
                                            <th className="text-right py-2 px-2 text-slate-300">Precio</th>
                                            <th className="text-right py-2 px-2 text-slate-300">Comisión</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 10).map((row, idx) => (
                                            <tr key={idx} className="border-b border-slate-700">
                                                <td className="py-2 px-2 text-white font-mono">{row.ticker}</td>
                                                <td className="py-2 px-2 text-slate-300">{row.fecha}</td>
                                                <td className="py-2 px-2 text-right text-slate-300 font-mono">
                                                    {row.nominales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-2 px-2 text-right text-slate-300 font-mono">
                                                    {row.precio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-2 px-2 text-right text-slate-300 font-mono">
                                                    {row.comision.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 10 && (
                                    <p className="text-xs text-slate-400 mt-2 text-center">
                                        ... y {preview.length - 10} filas más
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="space-y-2">
                            {result.success > 0 && (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                    <span className="text-green-300">
                                        {result.success} compra{result.success > 1 ? 's' : ''} importada{result.success > 1 ? 's' : ''} exitosamente
                                    </span>
                                </div>
                            )}
                            {result.errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="h-5 w-5 text-red-400" />
                                        <span className="text-red-300 font-medium">
                                            {result.errors.length} error{result.errors.length > 1 ? 'es' : ''}
                                        </span>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {result.errors.map((err, idx) => (
                                            <div key={idx} className="text-xs text-red-300">
                                                Fila {err.row}: {err.error}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                            {result ? 'Cerrar' : 'Cancelar'}
                        </Button>
                        {!result && showPreview && (
                            <Button
                                onClick={handleImport}
                                disabled={importing || preview.length === 0}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                {importing ? 'Importando...' : `Importar ${preview.length} compras`}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
