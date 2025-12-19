'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { register } from '@/app/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, Building, LineChart, Landmark, Wallet, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from "@/lib/utils";

const SECTIONS = [
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

export default function RegisterPage() {
    const [errorMessage, dispatch] = useFormState(register, undefined);
    const [step, setStep] = useState(1);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className={cn(
                "w-full bg-slate-900 border-slate-800 text-slate-100 transition-all duration-500",
                step === 1 ? "max-w-lg" : "max-w-4xl"
            )}>
                <CardHeader className="text-center pb-8 pt-8">
                    <div className="mx-auto bg-slate-800 p-4 rounded-full w-fit mb-6">
                        <UserPlus className="h-8 w-8 text-green-400" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">
                        {step === 1 ? 'Crear Cuenta' : 'Personaliza tu Experiencia'}
                    </CardTitle>
                    <CardDescription className="text-lg mt-2">
                        {step === 1 ? 'Comienza a trackear tus inversiones' : 'Selecciona las herramientas que necesitas hoy'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <form action={dispatch} className="space-y-6">

                        {/* STEP 1: ACCOUNT DETAILS */}
                        <div className={cn("space-y-4", step !== 1 && "hidden")}>
                            <div className="space-y-2">
                                <Input
                                    type="text"
                                    name="name"
                                    placeholder="Nombre completo"
                                    required={step === 1}
                                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Input
                                    type="email"
                                    name="email"
                                    placeholder="Email"
                                    required={step === 1}
                                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Input
                                    type="password"
                                    name="password"
                                    placeholder="Contraseña (min 6 caracteres)"
                                    required={step === 1}
                                    minLength={6}
                                    className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                                />
                            </div>

                            <Button
                                type="button"
                                onClick={() => setStep(2)}
                                className="w-full h-12 text-base font-medium bg-green-600 hover:bg-green-700 transition-all mt-4"
                            >
                                Continuar <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>

                        {/* STEP 2: SECTIONS SELECTION */}
                        <div className={cn("space-y-6", step !== 2 && "hidden")}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {SECTIONS.map((section) => (
                                    <FeatureCard key={section.id} section={section} />
                                ))}
                            </div>

                            <input type="hidden" name="sections" id="sections-input" />
                            <Script />

                            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 text-center">
                                <p className="text-sm text-slate-400">
                                    <span className="text-green-400 font-medium">Nota:</span> Lo que no selecciones ahora podrá ser activado luego desde el panel de Configuración.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStep(1)}
                                    className="h-12 px-6 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                                </Button>
                                <RegisterButton />
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-950/20 p-3 rounded border border-red-900/50">
                                <AlertCircle className="h-4 w-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <div className="text-center text-sm text-slate-500 mt-8">
                            ¿Ya tienes cuenta?{" "}
                            <Link href="/login" className="text-purple-400 font-medium hover:text-purple-300 hover:underline transition-colors">
                                Iniciar Sesión
                            </Link>
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
                "relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 group hover:shadow-lg hover:shadow-green-900/10",
                checked
                    ? "bg-slate-950/80 border-green-500/50 shadow-md shadow-green-900/20"
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
                <div className={cn("p-2 rounded-lg transition-colors", checked ? "bg-green-500/10 text-green-400" : "bg-slate-900 text-slate-500 group-hover:text-slate-400")}>
                    <section.icon className="h-6 w-6" />
                </div>
                {checked && <CheckCircle2 className="h-5 w-5 text-green-500" />}
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
                        <span className={cn("w-1 h-1 rounded-full mr-2", checked ? "bg-green-500/50" : "bg-slate-700")} />
                        {feat}
                    </li>
                ))}
            </ul>
        </label>
    );
}

function RegisterButton() {
    const { pending } = useFormStatus();

    return (
        <Button className="w-full h-12 text-base font-medium bg-green-600 hover:bg-green-700 transition-all flex-1" aria-disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Crear Cuenta"}
        </Button>
    );
}

function Script() {
    return (
        <script dangerouslySetInnerHTML={{
            __html: `
                const hiddenInput = document.getElementById('sections-input');
                
                // Function to update hidden input based on checked boxes
                function updateHiddenInput() {
                    const checkboxes = document.querySelectorAll('input[name="sections_checkbox"]');
                    const selected = Array.from(checkboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.value)
                        .join(',');
                    if(hiddenInput) hiddenInput.value = selected;
                }

                // Add event delegation for dynamically created inputs if needed, 
                // but since they are React controlled/rendered, we can also attach to a parent or use MutationObserver.
                // However, easier to just attach to document change for delegation or rely on React state if we weren't using FormData manually.
                
                // Simple event listener for the form modification
                document.addEventListener('change', function(e) {
                    if (e.target && e.target.name === 'sections_checkbox') {
                        updateHiddenInput();
                    }
                });

                // Initial Run
                setTimeout(updateHiddenInput, 500); // Small delay to ensure render
            `
        }} />
    );
}
