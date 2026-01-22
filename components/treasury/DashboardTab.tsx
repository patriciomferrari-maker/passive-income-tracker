'use client';

import { useState, useEffect } from 'react';
import { InvestmentsDashboardView, DashboardData } from '@/components/on/InvestmentsDashboardView';

export function DashboardTab() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showValues, setShowValues] = useState(true);

    useEffect(() => {
        loadDashboard();
        const savedPrivacy = localStorage.getItem('privacy_mode');
        if (savedPrivacy !== null) {
            setShowValues(savedPrivacy === 'true');
        }

        const handlePrivacyChange = () => {
            const savedPrivacy = localStorage.getItem('privacy_mode');
            if (savedPrivacy !== null) {
                setShowValues(savedPrivacy === 'true');
            }
        };
        window.addEventListener('privacy-changed', handlePrivacyChange);
        return () => window.removeEventListener('privacy-changed', handlePrivacyChange);
    }, []);

    const togglePrivacy = () => {
        const newValue = !showValues;
        setShowValues(newValue);
        localStorage.setItem('privacy_mode', String(newValue));
        window.dispatchEvent(new Event('privacy-changed'));
    };

    const loadDashboard = async () => {
        try {
            const res = await fetch('/api/investments/treasury/dashboard');
            const dashboardData = await res.json();
            setData(dashboardData);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="text-slate-400 text-center py-12">Cargando dashboard...</div>
        );
    }

    if (!data) {
        return (
            <div className="text-slate-400 text-center py-12">Error al cargar el dashboard</div>
        );
    }

    return (
        <InvestmentsDashboardView
            data={data}
            showValues={showValues}
            onTogglePrivacy={togglePrivacy}
        // hidePrivacyControls={false} // Default
        />
    );
}

