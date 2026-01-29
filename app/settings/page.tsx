
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Save, Send, CheckCircle, AlertCircle, ArrowLeft, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { LineChart, Landmark, Building, CreditCard, Wallet, Home, Palmtree, Coins, TrendingUp } from 'lucide-react';
import Link from 'next/link';

// Definition of sections (Rich format)
const allSections = [
    {
        id: 'on',
        label: 'Cartera Argentina',
        icon: LineChart,
        description: 'ONs y Cedears',
        features: ['Rendimientos', 'Calendario']
    },
    {
        id: 'treasury',
        label: 'Cartera USA',
        icon: Landmark,
        description: 'Bonos del Tesoro',
        features: ['Yield Curve', 'T-Bills']
    },
    {
        id: 'rentals',
        label: 'Alquileres',
        icon: Building,
        description: 'Propiedades y contratos',
        features: ['Rentas', 'Ajustes']
    },
    {
        id: 'debts',
        label: 'Deudas',
        icon: CreditCard,
        description: 'Pasivos y pagos',
        features: ['Préstamos', 'Tarjetas']
    },
    {
        id: 'bank',
        label: 'Banco & Liquidez',
        icon: Wallet,
        description: 'Saldos y Plazos Fijos',
        features: ['Liquidez', 'Cashflow']
    },
    {
        id: 'crypto',
        label: 'Crypto Portfolio',
        icon: Coins,
        description: 'Bitcoin y Ethereum',
        features: ['Precios Live', 'Total']
    },
    {
        id: 'economics',
        label: 'Datos Económicos',
        icon: TrendingUp,
        description: 'Variación IPC y UVA',
        features: ['Inflación', 'Dólar']
    },
    {
        id: 'barbosa',
        label: 'Hogar',
        icon: Home,
        description: 'Gastos domésticos',
        features: ['Presupuesto', 'Limpieza'],
        restricted: true
    },
    {
        id: 'costa',
        label: 'Costa Esmeralda',
        icon: Palmtree,
        description: 'Gestión vacacional',
        features: ['Alquiler', 'Expensas'],
        restricted: true
    }
];

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);

    const [emails, setEmails] = useState("");
    const [reportDay, setReportDay] = useState("1");
    const [reportHour, setReportHour] = useState("10");
    const [enabledSections, setEnabledSections] = useState<string[]>([]);

    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [userEmail, setUserEmail] = useState("");
    const [availableSections, setAvailableSections] = useState(allSections.filter(s => !s.restricted));

    useEffect(() => {
        fetch('/api/settings')
            .then(res => {
                if (!res.ok) throw new Error("API Error");
                return res.json();
            })
            .then(data => {
                // Ensure data exists
                if (data && data.notificationEmails !== undefined) {
                    setEmails(data.notificationEmails || "");
                    setReportDay((data.reportDay || 1).toString());
                    setReportHour((data.reportHour ?? 10).toString());
                    setEnabledSections(data.enabledSections ? data.enabledSections.split(',') : []);

                    // Handle restriction
                    const email = data.email ? data.email.toLowerCase() : '';
                    console.log('Settings fetched for:', email);

                    if (email === 'patriciomferrari@gmail.com') {
                        setAvailableSections(allSections);
                    } else {
                        // Reset to default if not generic
                        setAvailableSections(allSections.filter(s => !s.restricted));
                    }
                    setUserEmail(email);
                }
            })
            .catch(err => {
                console.error(err);
                setMessage({ type: 'error', text: 'Error al cargar la configuración.' });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notificationEmails: emails,
                    reportDay: parseInt(reportDay),
                    reportHour: parseInt(reportHour),
                    enabledSections: enabledSections.join(',')
                })
            });

            if (!res.ok) throw new Error('Failed to save');

            setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
        } catch (error) {
            setMessage({ type: 'error', text: 'No se pudo guardar la configuración.' });
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async () => {
        setSendingTest(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings/test-email', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send');
            }

            setMessage({ type: 'success', text: 'Correo de prueba enviado correctamente.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error al enviar correo de prueba.' });
        } finally {
            setSendingTest(false);
        }
    };

    const toggleSection = (sectionId: string) => {
        const isEnabled = enabledSections.includes(sectionId);
        if (isEnabled) {
            setEnabledSections(enabledSections.filter(id => id !== sectionId));
        } else {
            setEnabledSections([...enabledSections, sectionId]);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-500" /></div>;

    return (
        <div className="min-h-screen bg-slate-950 container mx-auto p-4 md:p-8 max-w-4xl space-y-8">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/" className="text-slate-500 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-bold text-white">Configuración</h1>
            </div>

            <Card className="bg-slate-950 border-slate-800 text-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-purple-400" />
                        Reportes Mensuales
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Configura cuándo y a quién se envían los resúmenes automáticos.
                        {userEmail && <span className="block mt-1 text-xs text-sky-400">Usuario detectado: {userEmail}</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {message && (
                        <div className={`p-4 rounded-md flex items-center gap-2 ${message.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-800' : 'bg-red-900/50 text-red-300 border border-red-800'}`}>
                            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            {message.text}
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="emails">Destinatarios</Label>
                        <Input
                            id="emails"
                            placeholder="email1@ejemplo.com, email2@ejemplo.com"
                            value={emails}
                            onChange={(e) => setEmails(e.target.value)}
                            className="bg-slate-950 border-slate-700 text-white"
                        />
                        <p className="text-xs text-slate-500">Separa múltiples correos con comas.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label>Día del Mes</Label>
                        <Select value={reportDay} onValueChange={setReportDay}>
                            <SelectTrigger className="w-[180px] bg-slate-950 border-slate-700 text-white">
                                <SelectValue placeholder="Seleccionar día" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                    <SelectItem key={day} value={day.toString()}>
                                        Día {day}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">El reporte se ejecutará automáticamente este día de cada mes.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label>Hora del Reporte (UTC)</Label>
                        <div className="flex items-center gap-4">
                            <Select value={reportHour} onValueChange={setReportHour}>
                                <SelectTrigger className="w-[180px] bg-slate-950 border-slate-700 text-white">
                                    <SelectValue placeholder="Seleccionar hora" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white h-60">
                                    {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                                        <SelectItem key={hour} value={hour.toString()}>
                                            {hour.toString().padStart(2, '0')}:00 UTC
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-slate-400">
                                (≈ {(parseInt(reportHour) - 3 + 24) % 24}:00 Hora Arg)
                            </span>
                        </div>
                        <p className="text-xs text-slate-500">
                            La hora es en UTC. Argentina suele ser UTC-3.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-slate-800">
                        <div className="flex items-center gap-2 mb-4">
                            <LayoutDashboard className="h-5 w-5 text-blue-400" />
                            <h3 className="text-lg font-semibold text-white">Secciones Visibles</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">
                            Selecciona las tarjetas que deseas ver en tu Dashboard.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {availableSections.map((section) => {
                                const isEnabled = enabledSections.includes(section.id);
                                return (
                                    <div
                                        key={section.id}
                                        onClick={() => toggleSection(section.id)}
                                        className={`
                                            relative flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 group
                                            ${isEnabled
                                                ? "bg-slate-950/60 border-emerald-500/40 shadow-sm shadow-emerald-900/10"
                                                : "bg-slate-950/30 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50"}
                                        `}
                                    >
                                        <div className={`p-2 rounded-lg mr-3 transition-colors ${isEnabled ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-slate-500 group-hover:text-slate-400"}`}>
                                            <section.icon className="h-5 w-5" />
                                        </div>

                                        <div className="flex-1">
                                            <h4 className={`text-sm font-medium ${isEnabled ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
                                                {section.label}
                                            </h4>
                                            <p className="text-xs text-slate-500 line-clamp-1">
                                                {section.description}
                                            </p>
                                        </div>

                                        {isEnabled && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-2" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-800">
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleSendTest}
                            disabled={sendingTest}
                        >
                            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Probar Envío Ahora
                        </Button>

                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar Cambios
                        </Button>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
