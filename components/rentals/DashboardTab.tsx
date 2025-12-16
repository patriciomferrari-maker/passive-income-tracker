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

    useEffect(() => {
        const loadResult = async () => {
            try {
                const [contractsRes, globalRes] = await Promise.all([
                    fetch('/api/rentals/dashboard'),
                    fetch('/api/rentals/global-dashboard')
                ]);

                const contractsJson = await contractsRes.json();
                const globalJson = await globalRes.json();

                if (Array.isArray(contractsJson)) {
                    setContractsData(contractsJson);
                }
                setGlobalData(globalJson);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadResult();
    }, []);

    return (
        <RentalsDashboardView
            contractsData={contractsData}
            globalData={globalData}
            showValues={showValues}
            loading={loading}
        />
    );
}
