
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Save, Send, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);

    const [emails, setEmails] = useState("");
    const [reportDay, setReportDay] = useState("1");
    const [reportHour, setReportHour] = useState("10");

    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.notificationEmails !== undefined) {
                    setEmails(data.notificationEmails);
                    setReportDay(data.reportDay.toString());
                    setReportHour((data.reportHour ?? 10).toString());
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
                    reportHour: parseInt(reportHour)
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
        } catch (error) {
            setMessage({ type: 'error', text: 'Error al enviar correo de prueba.' });
        } finally {
            setSendingTest(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-500" /></div>;

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-8">
            <h1 className="text-3xl font-bold text-white mb-6">Configuración</h1>

            <Card className="bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-purple-400" />
                        Reportes Mensuales
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Configura cuándo y a quién se envían los resúmenes automáticos.
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
