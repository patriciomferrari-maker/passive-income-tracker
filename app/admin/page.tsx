
'use client';

import { useState, useEffect } from 'react';
<CardContent>
    <p className="text-slate-400 text-xs mb-4">
        Cotización histórica y scraping diario (Automático).
    </p>

    <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-3 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
            <span>Fecha</span>
            <span className="text-right">Compra</span>
            <span className="text-right">Venta</span>
        </div>
        <div>
            {dollarData.length > 0 ? (
                dollarData.map((item, i) => (
                    <div key={i} className="grid grid-cols-3 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                        <span className="text-slate-300">{new Date(item.date).toLocaleDateString('es-AR')}</span>
                        <span className="text-right text-slate-400">${item.buyRate}</span>
                        <span className="text-right font-bold text-green-400">${item.sellRate}</span>
                    </div>
                ))
            ) : (
                <div className="p-4 text-center text-xs text-slate-500">
                    Cargando...
                </div>
            )}
        </div>
    </div>
</CardContent>
        </Card >
    );
}

function IPCCard() {
    const [inflationData, setInflationData] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/admin/inflation')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setInflationData(data);
            })
            .catch(err => console.error(err));
    }, []);

    return (
        <Card className="bg-slate-900 border-slate-800 h-fit">
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                        <span>Inflación (IPC)</span>
                        <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded">DatosMacro</span>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-slate-400 text-xs mb-4">
                    Scraping de datosmacro.expansion.com (Automático).
                </p>

                <div className="bg-slate-950 rounded-md border border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-3 bg-slate-900 p-2 text-xs font-medium text-slate-400 border-b border-slate-800">
                        <span>Año</span>
                        <span>Mes</span>
                        <span className="text-right">Valor</span>
                    </div>
                    <div>
                        {inflationData.length > 0 ? (
                            inflationData.map((item, i) => (
                                <div key={i} className="grid grid-cols-3 p-2 text-xs border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                                    <span className="text-slate-300">{item.year}</span>
                                    <span className="text-slate-500">{getMonthName(item.month)}</span>
                                    <span className="text-right font-bold text-slate-200">{item.value.toFixed(1)}%</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                                Cargando...
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function getMonthName(month: number) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[month - 1] || month;
}

function PriceList({ prices }: { prices: any[] }) {
    if (!prices || prices.length === 0) return <span className="text-xs text-yellow-500">No se encontraron títulos cargados para obtener el valor.</span>;

    return (
        <div className="bg-slate-950 p-4 rounded-md border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Resultados:</h4>
            <ul className="space-y-2">
                {prices.map((p: any, i: number) => (
                    <li key={i} className="text-xs flex justify-between items-center border-b border-slate-800 pb-1 last:border-0">
                        <div className="flex flex-col">
                            <span className="font-mono text-blue-400 font-bold">{p.ticker}</span>
                            <span className="text-[10px] text-slate-500">{p.source}</span>
                        </div>
                        {p.error ? (
                            <span className="text-red-400 flex items-center text-right"><AlertCircle className="w-3 h-3 mr-1" /> {p.error}</span>
                        ) : (
                            <span className="text-green-400 flex items-center font-bold text-right">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency || 'USD' }).format(p.price)}
                                <CheckCircle className="w-3 h-3 ml-1" />
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
