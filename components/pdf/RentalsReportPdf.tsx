import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Polyline } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// THEME CONSTANTS
const BG_DARK = '#020617'; // slate-950
const CARD_BG = '#0f172a'; // slate-900
const BORDER = '#1e293b'; // slate-800
const TEXT_MAIN = '#f8fafc';
const TEXT_MUTED = '#94a3b8';

const COLOR_EMERALD = '#10b981';
const COLOR_BLUE = '#3b82f6';
const COLOR_PURPLE = '#a855f7';
const COLOR_AMBER = '#f59e0b';

const styles = StyleSheet.create({
    page: { padding: 20, fontFamily: 'Helvetica', backgroundColor: BG_DARK, color: TEXT_MAIN },

    // Header
    header: { marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BORDER}`, paddingBottom: 10 },
    title: { fontSize: 20, fontWeight: 'bold', color: TEXT_MAIN, textTransform: 'uppercase', letterSpacing: 1 },
    badge: { fontSize: 10, color: TEXT_MUTED },

    // Top Stats Grid
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10, alignItems: 'center' },
    statLabel: { fontSize: 8, color: TEXT_MUTED, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
    statValue: { fontSize: 16, fontWeight: 'bold' },

    // Charts Section
    chartSection: { marginBottom: 20, backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 15 },
    chartTitle: { fontSize: 10, fontWeight: 'bold', color: TEXT_MUTED, marginBottom: 10 },

    // Property Grid
    propGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    propCard: { width: '48%', backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: 10, marginBottom: 10 },

    // Prop Header
    propHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, borderBottom: `1px solid ${BORDER}`, paddingBottom: 6 },
    propTitle: { fontSize: 12, fontWeight: 'bold' },

    // Prop Stats
    propStatsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    propStatLabel: { fontSize: 7, color: TEXT_MUTED },
    propStatValue: { fontSize: 9, fontWeight: 'bold' },

    footer: { position: 'absolute', bottom: 20, left: 20, right: 20, textAlign: 'center', color: '#334155', fontSize: 8 }
});

const formatMoney = (val: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
};

// Reusable Mini Bar Chart Component for PDF
const MiniBarChart = ({ data, color, height = 40 }: { data: number[], color: string, height?: number }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data) * 1.1; // 10% headroom
    const barWidth = (100 / data.length) - 2; // gap

    return (
        <Svg width="100%" height={height}>
            {data.map((val, i) => {
                const h = (val / max) * height;
                const x = i * (100 / data.length);
                const y = height - h;
                return (
                    <Rect
                        key={i}
                        x={`${x}%`}
                        y={y}
                        width={`${barWidth}%`}
                        height={h}
                        fill={color}
                        rx={2}
                    />
                );
            })}
        </Svg>
    );
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
            chartHistory?: number[]; // Added for mini sparklines
        }>;
        globalHistory?: number[];
    }
}

export const RentalsReportPdf = ({ data }: RentalsReportProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* 1. Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard General</Text>
                <Text style={styles.badge}>{data.month?.toUpperCase()} {data.year}</Text>
            </View>

            {/* 2. Top Stats Row (Neon Style) */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderTop: `2px solid ${COLOR_EMERALD}` }]}>
                    <Text style={[styles.statLabel, { color: COLOR_EMERALD }]}>Ingresos Mensuales</Text>
                    <Text style={[styles.statValue, { color: COLOR_EMERALD }]}>{formatMoney(data.summary.totalIncomeUSD)}</Text>
                </View>
                <View style={[styles.statCard, { borderTop: `2px solid ${COLOR_PURPLE}` }]}>
                    <Text style={[styles.statLabel, { color: COLOR_PURPLE }]}>Próximo Vencimiento</Text>
                    <Text style={styles.statValue}>{data.summary.nextExpiration?.property || '-'}</Text>
                    <Text style={[styles.badge, { color: COLOR_PURPLE }]}>
                        {data.summary.nextExpiration ? format(new Date(data.summary.nextExpiration.date), 'dd MMM yy', { locale: es }) : ''}
                    </Text>
                </View>
                <View style={[styles.statCard, { borderTop: `2px solid ${COLOR_AMBER}` }]}>
                    <Text style={[styles.statLabel, { color: COLOR_AMBER }]}>Próxima Actualización</Text>
                    <Text style={styles.statValue}>{data.summary.nextAdjustment?.property || '-'}</Text>
                    <Text style={[styles.badge, { color: COLOR_AMBER }]}>
                        {data.summary.nextAdjustment ? format(new Date(data.summary.nextAdjustment.date), 'dd MMM yy', { locale: es }) : ''}
                    </Text>
                </View>
                <View style={[styles.statCard, { borderTop: `2px solid ${COLOR_BLUE}` }]}>
                    <Text style={[styles.statLabel, { color: COLOR_BLUE }]}>Contratos Activos</Text>
                    <Text style={styles.statValue}>{data.summary.activeContracts}</Text>
                </View>
            </View>

            {/* 3. Global Chart Section */}
            {data.globalHistory && (
                <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>Evolución Ingresos Totales (USD) - Últimos 12 Meses</Text>
                    <MiniBarChart data={data.globalHistory} color={COLOR_EMERALD} height={80} />
                </View>
            )}

            {/* 4. Individual Properties Grid */}
            <View style={styles.propGrid}>
                {data.contracts.map((c, i) => (
                    <View key={i} style={styles.propCard}>
                        {/* Header */}
                        <View style={styles.propHeader}>
                            <View>
                                <Text style={styles.propTitle}>{c.property}</Text>
                                <Text style={[styles.badge, { fontSize: 8 }]}>{c.tenant}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.propTitle, { color: COLOR_EMERALD }]}>{formatMoney(c.rent)}</Text>
                                <Text style={[styles.badge, { fontSize: 7, color: COLOR_EMERALD }]}>{c.currency}</Text>
                            </View>
                        </View>

                        {/* Stats Info */}
                        <View style={styles.propStatsRow}>
                            <View>
                                <Text style={styles.propStatLabel}>PRÓX. AJUSTE</Text>
                                <Text style={styles.propStatValue}>{format(new Date(c.nextAdjustment), 'dd MMM', { locale: es })}</Text>
                            </View>
                            <View>
                                <Text style={styles.propStatLabel}>VENCIMIENTO</Text>
                                <Text style={styles.propStatValue}>{format(new Date(c.expiration), 'MMM yyyy', { locale: es })}</Text>
                            </View>
                        </View>

                        {/* Sparkline Chart */}
                        {c.chartHistory && (
                            <View style={{ marginTop: 10 }}>
                                <MiniBarChart data={c.chartHistory} color={COLOR_EMERALD} height={30} />
                            </View>
                        )}
                    </View>
                ))}
            </View>

            <Text style={styles.footer}>Passive Income Tracker • {format(new Date(), 'dd/MM/yyyy HH:mm')}</Text>
        </Page>
    </Document>
);
