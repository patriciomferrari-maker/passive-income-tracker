'use client';

import { useState, useEffect } from 'react';
import { RentalsDashboardView, ContractDashboardData } from './RentalsDashboardView';

interface DashboardTabProps {
    showValues: boolean;
}

export function DashboardTab({ showValues }: DashboardTabProps) {
    const [contractsData, setContractsData] = useState<ContractDashboardData[]>([]);
    const [globalData, setGlobalData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [errorType, setErrorType] = useState<'401' | 'generic' | null>(null);

    useEffect(() => {
        const loadResult = async () => {
            try {
                const [contractsRes, globalRes] = await Promise.all([
                    fetch('/api/rentals/dashboard'),
                    fetch('/api/rentals/global-dashboard')
                ]);

                if (contractsRes.status === 401 || globalRes.status === 401) {
                    setErrorType('401');
                    return; // Stop processing
                }

                if (!contractsRes.ok) {
                    try {
                        const err = await contractsRes.json();
                        console.error('Error Rentals Contracts:', err);
                    } catch (e) { }
                }
                if (!globalRes.ok) {
                    try {
                        const err = await globalRes.json();
                        console.error('Error Rentals Global:', err);
                    } catch (e) { }
                }

                const contractsJson = await contractsRes.json();
                const globalJson = await globalRes.json();

                if (Array.isArray(contractsJson)) {
                    setContractsData(contractsJson);
                }
                setGlobalData(globalJson);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                setErrorType('generic');
            } finally {
                setLoading(false);
            }
        };

        loadResult();
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando dashboard...</div>;

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

    return (
        <RentalsDashboardView
            contractsData={contractsData}
            globalData={globalData}
            showValues={showValues}
            loading={loading}
        />
    );
}
