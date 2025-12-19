'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';

interface DashboardCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    enabled?: boolean;
    count?: number;
    totalValue?: number;
    currency?: string;
    variant?: 'default' | 'red';
    children?: React.ReactNode;
    countLabel?: string;
    valueLabel?: string;
}

export function DashboardCard({
    title,
    description,
    icon,
    href,
    enabled = true,
    count,
    totalValue,
    currency = 'USD',
    variant = 'default',
    children,
    countLabel = 'Inversiones',
    valueLabel = 'Valor Total'
}: DashboardCardProps) {
    const isRed = variant === 'red';

    const CardContent = () => (
        <div className={`
            relative overflow-hidden h-full flex flex-col items-center text-center
            ${isRed
                ? 'bg-gradient-to-br from-red-950/40 to-slate-900 border-red-900/30'
                : 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700'}
            border rounded-xl p-6
            transition-all duration-300
            ${enabled
                ? isRed
                    ? 'hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20 hover:-translate-y-1 cursor-pointer'
                    : 'hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }
        `}>
            {/* Background decoration */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl 
                ${isRed
                    ? 'bg-gradient-to-br from-red-500/10 to-orange-500/10'
                    : 'bg-gradient-to-br from-blue-500/10 to-purple-500/10'}`}
            />

            <div className="relative z-10 w-full flex flex-col items-center">
                {/* Header/Icon */}
                <div className="relative w-full flex justify-center mb-4">
                    <div className="text-5xl drop-shadow-lg filter">{icon}</div>

                    {enabled && (
                        <div className="absolute top-0 right-0">
                            <ArrowRight className={`${isRed ? 'text-red-400 group-hover:text-red-300' : 'text-slate-400 group-hover:text-blue-400'} transition-colors`} size={20} />
                        </div>
                    )}
                    {!enabled && (
                        <div className="absolute top-0 right-0">
                            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded">
                                Soon
                            </span>
                        </div>
                    )}
                </div>

                {/* Title and Description */}
                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-[90%] mx-auto leading-relaxed">{description}</p>

                {/* Metrics */}
                {enabled && (count !== undefined || totalValue !== undefined) && (
                    <div className={`w-full border-t pt-4 ${isRed ? 'border-red-900/30' : 'border-slate-700'}`}>
                        <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800">
                            {count !== undefined && (
                                <div className="flex flex-col items-center justify-center">
                                    <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">{countLabel}</p>
                                    <p className="text-lg font-bold text-white">{count}</p>
                                </div>
                            )}
                            {totalValue !== undefined && (
                                <div className="flex flex-col items-center justify-center">
                                    <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">{valueLabel}</p>
                                    <p className={`text-lg font-bold flex items-center gap-1 ${isRed ? 'text-red-400' : 'text-emerald-400'}`}>
                                        <TrendingUp size={14} />
                                        {currency === 'USD' ? '$' : '$'}
                                        {totalValue.toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Custom Content (Children) */}
                {children}
            </div>
        </div>
    );

    if (!enabled) {
        return <CardContent />;
    }

    return (
        <Link href={href} className="group block h-full">
            <CardContent />
        </Link>
    );
}
