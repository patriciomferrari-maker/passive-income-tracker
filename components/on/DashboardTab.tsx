'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InvestmentsDashboardView, DashboardData } from './InvestmentsDashboardView';

interface DashboardTabProps {
    showValues: boolean;
    onTogglePrivacy: () => void;
}

export function DashboardTab({ showValues, onTogglePrivacy }: DashboardTabProps) {
    const router = useRouter();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState<'401' | 'generic' | null>(null);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const res = await fetch('/api/investments/on/dashboard');

                if (res.status === 401) {
                    setErrorType('401');
                    return;
                }

                if (!res.ok) {
                    try {
                        const errorJson = await res.json();
                        console.error('Server returned detailed error (ON):', errorJson);
                        if (errorJson.details) {
                            console.error('SPECIFIC SERVER ERROR (ON):', errorJson.details);
                        }
                    } catch (e) { /* ignore parse error */ }
                    throw new Error(`API Error: ${res.status}`);
                }

                if (res.ok) {
                    const data = await res.json();
                    setDashboardData(data);
                }
            } catch (error) {
                console.error('Error fetching dashboard:', error);
                setErrorType('generic');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Cargando dashboard...</div>;
    }

    if (errorType === '401') {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="text-amber-500 text-xl font-medium">Sesión Expirada</div>
                <div className="text-slate-400">Por favor, iniciá sesión nuevamente para ver el dashboard.</div>
                <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    Ir al Login
                </a>
            </div>
        );
    }

    // Redirect if it failed to load (and wasn't 401)
    if (!dashboardData) {
        router.push('/');
        return null;
    }

    return (
        <InvestmentsDashboardView
            data={dashboardData}
            showValues={showValues}
            onTogglePrivacy={onTogglePrivacy}
        />
    );
}
