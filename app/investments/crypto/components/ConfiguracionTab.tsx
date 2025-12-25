'use client';

export default function ConfiguracionTab() {
    return (
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4">⚙️ Configuración</h3>
                <p className="text-slate-400 mb-4">
                    Configuraciones adicionales para tu cartera de criptomonedas.
                </p>

                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">Fuente de Precios</h4>
                        <p className="text-sm text-slate-400 mb-2">
                            Selecciona de dónde obtener los precios de mercado actuales.
                        </p>
                        <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                            <option>Manual (actualización manual)</option>
                            <option disabled>CoinGecko API (próximamente)</option>
                            <option disabled>Binance API (próximamente)</option>
                        </select>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">Moneda de Referencia</h4>
                        <p className="text-sm text-slate-400 mb-2">
                            Moneda en la que se muestran los valores del portfolio.
                        </p>
                        <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                            <option>USD - Dólar Estadounidense</option>
                            <option disabled>EUR - Euro (próximamente)</option>
                            <option disabled>ARS - Peso Argentino (próximamente)</option>
                        </select>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">Método de Cálculo de Ganancias</h4>
                        <p className="text-sm text-slate-400 mb-2">
                            Método utilizado para calcular el costo base.
                        </p>
                        <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
                            <option>FIFO (First In, First Out)</option>
                            <option disabled>LIFO (Last In, First Out) - próximamente</option>
                            <option disabled>Promedio - próximamente</option>
                        </select>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-blue-950/20 border border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2">
                        <span className="text-blue-400">ℹ️</span>
                        <div className="text-sm text-blue-300">
                            <strong>Nota:</strong> Actualmente todas las funciones de configuración automática están en desarrollo.
                            Los precios se actualizan manualmente al registrar cada transacción.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
