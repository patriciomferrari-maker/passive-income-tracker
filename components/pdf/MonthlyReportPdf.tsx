import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register standard fonts
Font.register({
    family: 'Helvetica',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf' }, // Simplified, using standard fonts usually works better without registering external urls if possible, but let's stick to standard internal fonts if available.
        // Actually, 'Helvetica' is built-in to PDF. No need to register.
    ]
});

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 12,
        color: '#1e293b',
        backgroundColor: '#f8fafc'
    },
    header: {
        marginBottom: 30,
        borderBottom: '2px solid #3b82f6',
        paddingBottom: 10
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b'
    },
    section: {
        marginBottom: 20,
        backgroundColor: '#ffffff',
        padding: 15,
        borderRadius: 4,
        border: '1px solid #e2e8f0'
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#0f172a',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: 4
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
        paddingBottom: 2
    },
    label: {
        color: '#64748b'
    },
    value: {
        fontWeight: 'bold',
        color: '#0f172a'
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px solid #e2e8f0'
    },
    totalLabel: {
        fontWeight: 'bold',
        color: '#0f172a'
    },
    totalValue: {
        fontWeight: 'bold',
        color: '#10b981' // Green
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 10,
        borderTop: '1px solid #e2e8f0',
        paddingTop: 10
    }
});

const formatCurrency = (value: number, currency: 'USD' | 'ARS' = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

interface MonthlyReportPdfProps {
    data: {
        userName: string;
        month: string;
        year: string;
        totalNetWorthUSD: number;
        bank: {
            totalUSD: number;
        };
        investments: {
            totalUSD: number;
            totalArg: number;
            totalUSA: number;
        };
        rentals: {
            monthlyIncomeUSD: number;
            activeContracts: number;
        };
        debts: {
            totalPendingUSD: number;
        };
        maturities: any[]; // Brief array of maturing items
    };
    enabledSections: string[];
}

export const MonthlyReportPdf = ({ data, enabledSections }: MonthlyReportPdfProps) => {
    const showBank = enabledSections.includes('bank');
    const showInvestments = enabledSections.includes('on') || enabledSections.includes('cedear') || enabledSections.includes('treasury');
    const showRentals = enabledSections.includes('rentals');
    const showDebts = enabledSections.includes('debts');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Reporte Mensual</Text>
                    <Text style={styles.subtitle}>{data.month} {data.year} • {data.userName}</Text>
                </View>

                {/* Global Summary */}
                <View style={[styles.section, { borderLeft: '4px solid #3b82f6' }]}>
                    <Text style={styles.sectionTitle}>Resumen Patrimonial</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Patrimonio Neto Total (Estimado)</Text>
                        <Text style={[styles.value, { fontSize: 18, color: '#3b82f6' }]}>{formatCurrency(data.totalNetWorthUSD)}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Ingreso Pasivo Mensual (Rentals)</Text>
                        <Text style={styles.value}>{formatCurrency(data.rentals.monthlyIncomeUSD)} / mes</Text>
                    </View>
                </View>

                {/* Investments Section */}
                {showInvestments && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Inversiones</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Cartera Argentina (ONs/Cedears)</Text>
                            <Text style={styles.value}>{formatCurrency(data.investments.totalArg)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Cartera USA (Treasuries/ETFs)</Text>
                            <Text style={styles.value}>{formatCurrency(data.investments.totalUSA)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total Invertido</Text>
                            <Text style={styles.totalValue}>{formatCurrency(data.investments.totalUSD)}</Text>
                        </View>
                    </View>
                )}

                {/* Rentals Section */}
                {showRentals && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Alquileres</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Propiedades Alquiladas</Text>
                            <Text style={styles.value}>{data.rentals.activeContracts}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Renta Mensual Actual</Text>
                            <Text style={styles.value}>{formatCurrency(data.rentals.monthlyIncomeUSD)}</Text>
                        </View>
                    </View>
                )}

                {/* Bank / Liquidity */}
                {showBank && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Banco y Liquidez</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Total Caja de Ahorro / PF</Text>
                            <Text style={styles.value}>{formatCurrency(data.bank.totalUSD)}</Text>
                        </View>
                    </View>
                )}

                {/* Debts */}
                {showDebts && data.debts.totalPendingUSD > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Deudas Pendientes</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>Saldo Pendiente</Text>
                            <Text style={[styles.value, { color: '#ef4444' }]}>{formatCurrency(data.debts.totalPendingUSD)}</Text>
                        </View>
                    </View>
                )}

                {/* Footer */}
                <Text style={styles.footer}>
                    Generado automáticamente por Passive Income Tracker • {new Date().toLocaleDateString()}
                </Text>
            </Page>
        </Document>
    );
};
