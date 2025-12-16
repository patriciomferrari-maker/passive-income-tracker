'use client';

import { useState, useEffect } from 'react';
import { InvestmentsDashboardView, DashboardData } from './InvestmentsDashboardView';

interface DashboardTabProps {
    showValues: boolean;
    onTogglePrivacy: () => void;
}

export function DashboardTab({ showValues, onTogglePrivacy }: DashboardTabProps) {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const res = await fetch('/api/investments/on/dashboard');
                if (res.ok) {
                    const data = await res.json();
                    setDashboardData(data);
                }
            } catch (error) {
                console.error('Error fetching dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Cargando dashboard...</div>;
    }

    if (!dashboardData) {
        return <div className="p-8 text-center text-slate-400">No se pudo cargar la información.</div>;
    }

    return (
        <InvestmentsDashboardView
            data={dashboardData}
            showValues={showValues}
            onTogglePrivacy={onTogglePrivacy}
        />
    );
}
