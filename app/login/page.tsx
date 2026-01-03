
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { authenticate, signInGoogle } from '@/app/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [errorMessage, dispatch] = useFormState(authenticate, undefined);

    return (

        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="text-center pb-8 pt-8">
                    <div className="mx-auto bg-slate-800 p-4 rounded-full w-fit mb-6">
                        <Lock className="h-8 w-8 text-purple-400" />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">Bienvenido</CardTitle>
                    <CardDescription className="text-lg mt-2">Ingresa a tu cuenta para continuar</CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                    <form action={dispatch} className="space-y-5">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                name="email"
                                placeholder="Email"
                                required
                                className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                name="password"
                                placeholder="Contraseña"
                                required
                                className="h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                            />
                            <div className="flex justify-end pt-1">
                                <a href="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300 hover:underline">
                                    ¿Olvidaste tu contraseña?
                                </a>
                            </div>
                        </div>
                        <LoginButton />

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-950/20 p-3 rounded border border-red-900/50">
                                <AlertCircle className="h-4 w-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900 px-4 text-slate-500 font-medium">O continuar con</span>
                        </div>
                    </div>

                    <form action={signInGoogle}>
                        <Button variant="outline" className="w-full h-12 border-slate-700 bg-white text-slate-900 hover:bg-slate-100 hover:text-black font-medium transition-all" type="submit">
                            <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Continuar con Google
                        </Button>
                    </form>

                    <div className="text-center text-sm text-slate-500 mt-8">
                        ¿No tienes cuenta?{" "}
                        <a href="/register" className="text-purple-400 font-medium hover:text-purple-300 hover:underline transition-colors">
                            Crear cuenta nueva
                        </a>
                    </div>
                </CardContent>

            </Card>
        </div>
    );
}

function LoginButton() {
    const { pending } = useFormStatus();

    return (
        <Button className="w-full h-12 text-base font-medium bg-purple-600 hover:bg-purple-700 transition-all" aria-disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Ingresar"}
        </Button>
    );
}
