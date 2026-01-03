'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong. Please try again.');
            }

            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Error al enviar el correo. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
                <Card className="w-full max-w-md bg-slate-900 border-slate-800 animate-in fade-in zoom-in duration-300">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-green-900/30 p-3 rounded-full w-fit mb-4">
                            <Mail className="h-8 w-8 text-green-400" />
                        </div>
                        <CardTitle className="text-2xl text-white">Revisa tu correo</CardTitle>
                        <CardDescription className="text-slate-400">
                            Si existe una cuenta asociada a {email}, recibirás un enlace para restaurar tu contraseña.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Link href="/login">
                            <Button variant="ghost" className="text-slate-400 hover:text-white">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Login
                            </Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-2xl text-white">Recuperar Contraseña</CardTitle>
                    <CardDescription className="text-slate-400">
                        Ingresa tu email y te enviaremos un enlace para restaurarla.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-slate-300">Email</label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nombre@ejemplo.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-slate-950 border-slate-800 text-white focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={loading}
                        >
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : 'Enviar Enlace'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link href="/login" className="text-sm text-slate-500 hover:text-blue-400 flex items-center transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
