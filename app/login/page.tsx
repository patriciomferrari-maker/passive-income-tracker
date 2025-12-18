
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
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-slate-800 p-3 rounded-full w-fit mb-4">
                        <Lock className="h-6 w-6 text-purple-400" />
                    </div>
                    <CardTitle className="text-2xl">Bienvenido</CardTitle>
                    <CardDescription>Ingresa a tu cuenta</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={dispatch} className="space-y-4">
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
                                placeholder="Contraseña"
                                required
                                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                            />
                        </div>
                        <LoginButton />

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mt-2 bg-red-950/20 p-2 rounded">
                                <AlertCircle className="h-4 w-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                    </form>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-slate-900 px-2 text-slate-500">O continuar con</span>
                        </div>
                    </div>
                    <form action={signInGoogle}>
                        <Button variant="outline" className="w-full border-slate-700 bg-slate-950 text-white hover:bg-slate-800 hover:text-white" type="submit">
                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Google
                        </Button>
                    </form>

                    <div className="text-center text-sm text-slate-500 mt-4 mb-4">
                        ¿No tienes cuenta?{" "}
                        <a href="/register" className="text-purple-400 hover:text-purple-300 hover:underline">
                            Regístrate
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
        <Button className="w-full bg-purple-600 hover:bg-purple-700" aria-disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ingresar"}
        </Button>
    );
}
