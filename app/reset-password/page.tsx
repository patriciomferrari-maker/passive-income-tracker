'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, ArrowLeft, CheckCircle } from "lucide-react";
import { Suspense } from 'react';

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    // Validate token presence
    useEffect(() => {
        if (!token) {
            setError('Token inválido o faltante.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al restaurar contraseña');
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <Card className="w-full max-w-md bg-slate-900 border-slate-800">
                <CardContent className="pt-6 text-center text-red-400">
                    Token inválido o enlace roto.
                </CardContent>
                <CardFooter className="justify-center">
                    <Link href="/login" className="text-blue-400 hover:underline">Volver al login</Link>
                </CardFooter>
            </Card>
        )
    }

    if (success) {
        return (
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 animate-in fade-in zoom-in">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-green-900/30 p-3 rounded-full w-fit mb-4">
                        <CheckCircle className="h-8 w-8 text-green-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">¡Contraseña Restaurada!</CardTitle>
                    <CardDescription className="text-slate-400">
                        Tu contraseña ha sido actualizada correctamente. Redirigiendote al login...
                    </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-center">
                    <Loader2 className="animate-spin text-blue-500" />
                </CardFooter>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
            <CardHeader>
                <CardTitle className="text-2xl text-white">Nueva Contraseña</CardTitle>
                <CardDescription className="text-slate-400">
                    Ingresa tu nueva contraseña para acceder.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nueva Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input
                                type="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9 bg-slate-950 border-slate-800 text-white focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Confirmar Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <Input
                                type="password"
                                placeholder="••••••••"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-9 bg-slate-950 border-slate-800 text-white focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-500 bg-red-900/10 p-2 rounded border border-red-900/50">{error}</p>}
                    <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={loading}
                    >
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restaurando...</> : 'Cambiar Contraseña'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
            <Suspense fallback={<Loader2 className="animate-spin text-white" />}>
                <ResetPasswordContent />
            </Suspense>
        </div>
    )
}
