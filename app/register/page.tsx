
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
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-slate-800 p-3 rounded-full w-fit mb-4">
                        <UserPlus className="h-6 w-6 text-green-400" />
                    </div>
                    <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
                    <CardDescription>Comienza a trackear tus inversiones</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={dispatch} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="text"
                                name="name"
                                placeholder="Nombre completo"
                                required
                                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="email"
                                name="email"
                                placeholder="Email"
                                required
                                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                name="password"
                                placeholder="Contraseña (min 6 caracteres)"
                                required
                                minLength={6}
                                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <RegisterButton />

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-950/20 p-2 rounded">
                                <AlertCircle className="h-4 w-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <div className="text-center text-sm text-slate-500 mt-4">
                            ¿Ya tienes cuenta?{" "}
                            <Link href="/login" className="text-purple-400 hover:text-purple-300 hover:underline">
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
        <Button className="w-full bg-green-600 hover:bg-green-700" aria-disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Registrarse"}
        </Button>
    );
}
