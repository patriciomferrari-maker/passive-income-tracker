'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Label } from 'recharts';

interface SectorData {
    name: string;
    value: number;
    fill?: string;
}

interface SectorChartProps {
    data: SectorData[];
    showValues: boolean;
    formatMoney: (value: number) => string;
    height?: number | string;
}

const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1',
    '#84cc16', '#14b8a6', '#f43f5e', '#64748b'
];

export function SectorChart({ data, showValues, formatMoney, height = "100%" }: SectorChartProps) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-slate-500 text-xs">Sin datos de sector</div>;
    }

    // Assign colors if not present
    const chartData = data.map((item, index) => ({
        ...item,
        fill: item.fill || COLORS[index % COLORS.length]
    })).sort((a, b) => b.value - a.value);

    return (
        <ResponsiveContainer width="100%" height={height}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="rgba(0,0,0,0)"
                    // Label only if values are shown
                    label={showValues ? (entry: any) => `${entry.name} (${((entry.value / chartData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%)` : undefined}
                    labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: number) => showValues ? formatMoney(value) : '****'}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
