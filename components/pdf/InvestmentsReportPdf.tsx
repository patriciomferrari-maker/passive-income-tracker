import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Helvetica', backgroundColor: '#0f172a', color: '#ffffff' },
    header: { marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
    subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4 },

    kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    kpiCard: {
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 8,
        width: '32%',
        border: '1px solid #334155'
    },
    kpiLabel: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 5 },
    kpiValue: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
    kpiSub: { fontSize: 8, color: '#64748b', marginTop: 2 },

    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#f8fafc', marginBottom: 10, marginTop: 10 },

    table: { width: '100%', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden', marginBottom: 15 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 8, borderBottom: '1px solid #334155' },
    tableRow: { flexDirection: 'row', padding: 8, borderBottom: '1px solid #334155' },
    col1: { width: '40%' },
    col2: { width: '20%' },
    col3: { width: '20%' },
    col4: { width: '20%', textAlign: 'right' },
    th: { fontSize: 8, color: '#94a3b8', fontWeight: 'bold' },
    td: { fontSize: 9, color: '#e2e8f0' },
    tdBold: { fontSize: 9, color: '#ffffff', fontWeight: 'bold' },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', color: '#475569', fontSize: 8 }
});

const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

interface InvestmentsReportProps {
    data: {
        month: string;
        year: string;
        userName: string;
        summary: {
            investedArg: number;
            investedUSA: number;
            total: number;
        };
        nextPayments: Array<{
            date: string;
            ticker: string;
            type: string;
            amount: number;
        }>;
    }
}

export const InvestmentsReportPdf = ({ data }: InvestmentsReportProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard Inversiones</Text>
                <Text style={styles.subtitle}>{data.month} {data.year} • {data.userName}</Text>
            </View>

            {/* KPIs */}
            <View style={styles.kpiContainer}>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#3b82f6' }]}>Cartera Argentina</Text>
                    <Text style={styles.kpiValue}>{formatMoney(data.summary.investedArg)}</Text>
                    <Text style={styles.kpiSub}>ONs + Cedears</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#8b5cf6' }]}>Cartera USA</Text>
                    <Text style={styles.kpiValue}>{formatMoney(data.summary.investedUSA)}</Text>
                    <Text style={styles.kpiSub}>Treasuries + ETFs</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiLabel, { color: '#10b981' }]}>Total Invertido</Text>
                    <Text style={styles.kpiValue}>{formatMoney(data.summary.total)}</Text>
                    <Text style={styles.kpiSub}>Consolidado</Text>
                </View>
            </View>

            {/* Next Payments */}
            <Text style={styles.sectionTitle}>Próximos Cobros (Mes Actual)</Text>
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.col1, styles.th]}>ACTIVO</Text>
                    <Text style={[styles.col2, styles.th]}>FECHA</Text>
                    <Text style={[styles.col3, styles.th]}>TIPO</Text>
                    <Text style={[styles.col4, styles.th]}>MONTO</Text>
                </View>
                {data.nextPayments.length > 0 ? (
                    data.nextPayments.map((p, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={[styles.col1, styles.tdBold]}>{p.ticker}</Text>
                            <Text style={[styles.col2, styles.td]}>{format(new Date(p.date), 'dd/MM/yyyy')}</Text>
                            <Text style={[styles.col3, styles.td, { color: p.type === 'INTEREST' ? '#86efac' : '#93c5fd' }]}>
                                {p.type === 'INTEREST' ? 'Renta' : 'Amort.'}
                            </Text>
                            <Text style={[styles.col4, styles.tdBold]}>{formatMoney(p.amount)}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.tableRow}>
                        <Text style={[styles.col1, { color: '#64748b' }]}>No hay cobros proyectados para este mes.</Text>
                    </View>
                )}
            </View>

            <Text style={styles.footer}>Generado el {new Date().toLocaleDateString()}</Text>
        </Page>
    </Document>
);
