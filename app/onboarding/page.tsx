'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveOnboarding } from '@/app/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle2, LineChart, Landmark, Building, CreditCard, Wallet } from 'lucide-react';
import { useState } from 'react';
import { cn } from "@/lib/utils";

const SECTIONS = [
    // <--- EDITAR TEXTO AQUI: Título (label), Descripción (description), y Puntos (features) ---
    {
        id: 'on',
        label: 'Cartera Argentina',
        icon: LineChart,
        description: 'Seguimiento detallado de Obligaciones Negociables.',
        features: ['Curvas de Rendimiento', 'Calendario de Pagos', 'Análisis TIR/Maturity']
    },
    {
        id: 'treasury',
        label: 'Cartera USA',
        icon: Landmark,
        description: 'Inversiones en Bonos del Tesoro Americano.',
        features: ['Yield Curve en tiempo real', 'Treasury Bills & Bonds', 'Riesgo Soberano']
    },
    {
        id: 'rentals',
        label: 'Alquileres',
        icon: Building,
        description: 'Gestión integral de propiedades en renta.',
        features: ['Control de Contratos', 'Ajustes automáticos', 'Rentabilidad Neta (ROI)']
    },
    {
        id: 'debts',
        label: 'Deudas',
        icon: CreditCard,
        description: 'Administración de pasivos y plan de pagos.',
        features: ['Préstamos Personales', 'Tarjetas de Crédito', 'Estrategia de Cancelación']
    },
    {
        id: 'bank',
        label: 'Banco & Liquidez',
        icon: Wallet,
        description: 'Control de saldos y disponibilidad inmediata.',
        features: ['Plazos Fijos', 'Saldos Consolidados', 'Cash Flow']
    }
];

export default function OnboardingPage() {
    const [errorMessage, dispatch] = useFormState(saveOnboarding, undefined);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="text-center pb-8 pt-8">
                    <CardTitle className="text-3xl font-bold text-white">
                        Personaliza tu Experiencia
                    </CardTitle>
                    <CardDescription className="text-lg mt-2">
                        Selecciona las herramientas que necesitas hoy
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <form action={dispatch} className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {SECTIONS.map((section) => (
                                <FeatureCard key={section.id} section={section} />
                            ))}
                        </div>

                        <input type="hidden" name="sections" id="sections-input" />
                        <Script />

                        <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 text-center">
                            <p className="text-sm text-slate-400">
                                <span className="text-emerald-400 font-medium">Nota:</span> Lo que no selecciones ahora podrá ser activado luego desde el panel de Configuración.
                            </p>
                        </div>

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-950/20 p-3 rounded border border-red-900/50">
                                <AlertCircle className="h-4 w-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <div className="pt-4">
                            <SaveButton />
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

function FeatureCard({ section }: { section: any }) {
    const [checked, setChecked] = useState(true);

    return (
        <label
            className={cn(
                "relative flex flex-col p-5 rounded-xl border cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-emerald-900/10",
                checked
                    ? "bg-slate-950/60 border-emerald-500/40 shadow-sm shadow-emerald-900/10"
                    : "bg-slate-950/30 border-slate-800 hover:border-slate-700"
            )}
        >
            <input
                type="checkbox"
                name="sections_checkbox"
                value={section.id}
                className="sr-only"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
            />

            <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2 rounded-lg transition-colors", checked ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-slate-500 group-hover:text-slate-400")}>
                    <section.icon className="h-6 w-6" />
                </div>
                {checked && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            </div>

            <h3 className={cn("font-semibold text-lg mb-1", checked ? "text-white" : "text-slate-400")}>
                {section.label}
            </h3>

            <p className="text-sm text-slate-500 mb-4 h-10 leading-snug">
                {section.description}
            </p>

            <ul className="space-y-1 mt-auto">
                {section.features.map((feat: string, i: number) => (
                    <li key={i} className="text-xs text-slate-400 flex items-center">
                        <span className={cn("w-1 h-1 rounded-full mr-2", checked ? "bg-emerald-500/50" : "bg-slate-700")} />
                        {feat}
                    </li>
                ))}
            </ul>
        </label>
    );
}

function SaveButton() {
    const { pending } = useFormStatus();

    return (
        <Button className="w-full h-12 text-base font-medium bg-emerald-600 hover:bg-emerald-700 transition-all" aria-disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Guardar y Continuar"}
        </Button>
    );
}

function Script() {
    return (
        <script dangerouslySetInnerHTML={{
            __html: `
                const hiddenInput = document.getElementById('sections-input');
                
                function updateHiddenInput() {
                    const checkboxes = document.querySelectorAll('input[name="sections_checkbox"]');
                    const selected = Array.from(checkboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.value)
                        .join(',');
                    if(hiddenInput) hiddenInput.value = selected;
                }

                document.addEventListener('change', function(e) {
                    if (e.target && e.target.name === 'sections_checkbox') {
                        updateHiddenInput();
                    }
                });

                setTimeout(updateHiddenInput, 500); 
            `
        }} />
    );
}
