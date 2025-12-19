'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { register } from '@/app/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
    const [errorMessage, dispatch] = useFormState(register, undefined);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="text-center pb-8 pt-8">
                    <div className="mx-auto bg-slate-800 p-4 rounded-full w-fit mb-6">
                        <UserPlus className="h-8 w-8 text-emerald-400" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">Crear Cuenta</CardTitle>
                    <CardDescription className="text-lg mt-2">Comienza a trackear tus inversiones</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <form action={dispatch} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="text"
                                name="name"
                                placeholder="Nombre completo"
                                required
                                className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="email"
                                name="email"
                                placeholder="Email"
                                required
                                className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                name="password"
                                placeholder="Contraseña (min 6 caracteres)"
                                required
                                minLength={6}
                                className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                            />
                        </div>

                        <RegisterButton />

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-950/20 p-3 rounded border border-red-900/50">
                                <AlertCircle className="h-4 w-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <div className="text-center text-sm text-slate-500 mt-8">
                            ¿Ya tienes cuenta?{" "}
                            <Link href="/login" className="text-emerald-400 font-medium hover:text-emerald-300 hover:underline transition-colors">
                                Iniciar Sesión
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

function RegisterButton() {
    const { pending } = useFormStatus();

    return (
        <Button className="w-full h-12 text-base font-medium bg-emerald-600 hover:bg-emerald-700 transition-all" aria-disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Registrarse"}
        </Button>
    );
}
