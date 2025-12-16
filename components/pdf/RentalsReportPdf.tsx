import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Helvetica', backgroundColor: '#0f172a', color: '#ffffff' }, // Dark theme like dashboard
    header: { marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
    subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },

    // KPI Cards Row
    kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    kpiCard: {
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 8,
        width: '23%',
        border: '1px solid #334155'
    },
    kpiLabel: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 5 },
    kpiValue: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
    kpiSub: { fontSize: 8, color: '#64748b', marginTop: 2 },

    // Section
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#f8fafc', marginBottom: 10, marginTop: 10 },

    // Table
    table: { width: '100%', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 8, borderBottom: '1px solid #334155' },
    tableRow: { flexDirection: 'row', padding: 8, borderBottom: '1px solid #334155' },
    col1: { width: '30%' },
    col2: { width: '25%' },
    col3: { width: '25%' },
    col4: { width: '20%', textAlign: 'right' },
    th: { fontSize: 8, color: '#94a3b8', fontWeight: 'bold' },
    td: { fontSize: 9, color: '#e2e8f0' },
    tdBold: { fontSize: 9, color: '#ffffff', fontWeight: 'bold' },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: '#475569', fontSize: 8 }
});

const formatMoney = (val: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(val);
};

interface RentalsReportProps {
    data: {
        month: string;
        year: string;
        userName: string;
        summary: {
            totalIncomeUSD: number;
            totalIncomeARS: number;
            activeContracts: number;
            nextExpiration: { property: string, date: string } | null;
            nextAdjustment: { property: string, date: string } | null;
        };
        contracts: Array<{
            property: string;
            tenant: string;
            rent: number;
            currency: string;
            status: string;
            nextAdjustment: string;
            expiration: string;
        }>;
    }
}

export const RentalsReportPdf = ({ data }: RentalsReportProps) => (
    <Document>
        <Page size="A4" orientation="landscape" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard Alquileres</Text>
                <Text style={styles.subtitle}>{data.month} {data.year} • {data.userName}</Text>
            </View>

            {/* KPIs */}
            <View style={styles.kpiContainer}>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#10b981' }]}>Ingresos Mes (USD)</Text>
                    <Text style={[styles.kpiValue, { color: '#10b981' }]}>{formatMoney(data.summary.totalIncomeUSD, 'USD')}</Text>
                    {data.summary.totalIncomeARS > 0 && <Text style={styles.kpiSub}>+ {formatMoney(data.summary.totalIncomeARS, 'ARS')}</Text>}
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#a855f7' }]}>Próximo Vencimiento</Text>
                    <Text style={styles.kpiValue}>{data.summary.nextExpiration ? data.summary.nextExpiration.property : '-'}</Text>
                    <Text style={styles.kpiSub}>{data.summary.nextExpiration ? format(new Date(data.summary.nextExpiration.date), 'dd MMM yyyy', { locale: es }) : 'Sin datos'}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#f59e0b' }]}>Próxima Actualización</Text>
                    <Text style={styles.kpiValue}>{data.summary.nextAdjustment ? data.summary.nextAdjustment.property : '-'}</Text>
                    <Text style={styles.kpiSub}>{data.summary.nextAdjustment ? format(new Date(data.summary.nextAdjustment.date), 'dd MMM yyyy', { locale: es }) : 'Sin datos'}</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#3b82f6' }]}>Contratos Activos</Text>
                    <Text style={styles.kpiValue}>{data.summary.activeContracts}</Text>
                    <Text style={styles.kpiSub}>Propiedades</Text>
                </View>
            </View>

            {/* Active Contracts Table */}
            <Text style={styles.sectionTitle}>Detalle de Contratos Vigentes</Text>
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.col1, styles.th]}>PROPIEDAD</Text>
                    <Text style={[styles.col2, styles.th]}>INQUILINO</Text>
                    <Text style={[styles.col3, styles.th]}>PRÓX. AJUSTE</Text>
                    <Text style={[styles.col4, styles.th]}>ALQUILER</Text>
                </View>
                {data.contracts.map((c, i) => (
                    <View key={i} style={styles.tableRow}>
                        <Text style={[styles.col1, styles.tdBold]}>{c.property}</Text>
                        <Text style={[styles.col2, styles.td]}>{c.tenant}</Text>
                        <Text style={[styles.col3, styles.td]}>{format(new Date(c.nextAdjustment), 'dd MMM yyyy', { locale: es })}</Text>
                        <Text style={[styles.col4, styles.tdBold, { color: c.currency === 'USD' ? '#10b981' : '#f8fafc' }]}>
                            {formatMoney(c.rent, c.currency)}
                        </Text>
                    </View>
                ))}
            </View>

            <Text style={styles.footer}>Generado el {new Date().toLocaleDateString()}</Text>
        </Page>
    </Document>
);
