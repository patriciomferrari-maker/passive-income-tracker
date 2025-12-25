'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getCryptoIcon } from '@/app/lib/crypto-list';

interface PortfolioData {
    ticker: string;
    name: string;
    value: number;
    percentage: number;
}

interface PortfolioChartProps {
    data: PortfolioData[];
}

const COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // green
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#84cc16', // lime
    '#d946ef', // fuchsia
];

export default function PortfolioChart({ data }: PortfolioChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                No hay datos para mostrar
            </div>
        );
    }

    const chartData = data.map((item, index) => ({
        name: item.ticker,
        value: item.value,
        percentage: item.percentage,
        color: COLORS[index % COLORS.length]
    }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                    <div className="font-semibold flex items-center gap-2">
                        <span>{getCryptoIcon(data.name)}</span>
                        {data.name}
                    </div>
                    <div className="text-sm text-slate-300 mt-1">
                        ${data.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-slate-400">
                        {data.payload.percentage.toFixed(1)}% del portfolio
                    </div>
                </div>
            );
        }
        return null;
    };

    const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
        if (percentage < 5) return null; // Don't show labels for small slices

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                className="text-sm font-semibold"
            >
                {`${percentage.toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={CustomLabel}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry: any) => (
                            <span className="text-slate-300">
                                {getCryptoIcon(value)} {value}
                            </span>
                        )}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
