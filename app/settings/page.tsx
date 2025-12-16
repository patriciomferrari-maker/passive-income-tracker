
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Save, Send, CheckCircle, AlertCircle, ArrowLeft, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

// Definition of sections
const allSections = [
    { id: 'on', label: 'Cartera Argentina (ONs/Cedears)' },
    { id: 'treasury', label: 'Cartera USA (Treasuries)' },
    { id: 'rentals', label: 'Alquileres' },
    { id: 'costa', label: 'Costa Esmeralda' },
    { id: 'debts', label: 'Deudas a Cobrar' },
    { id: 'bank', label: 'Banco (PF/FCI)' },
    // Hidden by default, only for specific users
    { id: 'barbosa', label: 'Barbosa (Hogar)', restricted: true },
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

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-500" /></div>;

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-8">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/" className="text-slate-500 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-bold text-white">Configuración</h1>
            </div>

            <Card className="bg-slate-900 border-slate-800 text-slate-100">
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
                            Elige qué tarjetas ver en el Dashboard principal.
                        </p>

                        <div className="grid grid-cols-1 gap-3">
                            {availableSections.map((section) => (
                                <div key={section.id} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id={`setting-${section.id}`}
                                        checked={enabledSections.includes(section.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setEnabledSections([...enabledSections, section.id]);
                                            } else {
                                                setEnabledSections(enabledSections.filter(id => id !== section.id));
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-green-600 focus:ring-green-600"
                                    />
                                    <label
                                        htmlFor={`setting-${section.id}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-300"
                                    >
                                        {section.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-slate-800">
                        <Button
                            variant="outline"
                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
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
