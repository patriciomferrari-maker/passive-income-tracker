
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getNextIndecReleaseDate, getDaysUntilNextRelease } from '@/app/lib/indec-calendar';

const formatCurrency = (val: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(val);
};

interface MaturityItem {
    date: Date;
    description: string;
    amount: number;
    currency: string;
    type: 'ON' | 'TREASURY' | 'RENTAL' | 'PF' | 'OTHER';
}

export interface PassiveIncomeStats {
    monthName: string;
    total: number;
    interests: {
        arg: number;
        usa: number;
    };
    rentals: {
        regular: number;
        costa: number; // Only for main user usually
    };
    plazoFijo: number; // Only interest
    debtCollected: number;
}

interface MonthlyReportData {
    userName: string;
    month: string;
    year: string;
    dashboardUrl: string;

    // Header Metrics
    totalDebtPending: number;
    totalBank: number;
    totalArg: number;
    totalUSA: number;

    // Details
    maturities: MaturityItem[];

    // NEW: Previous Month Passive Income
    previousMonthPassiveIncome?: PassiveIncomeStats;

    // Highlights
    rentalEvents: { date: Date; property: string; type: 'ADJUSTMENT' | 'EXPIRATION'; monthsTo: number }[];

    // Flags
    hasRentals?: boolean;
    hasArg?: boolean;
    hasUSA?: boolean;
    hasBank?: boolean;
    hasDebts?: boolean;
}

export function generateMonthlyReportEmail(data: MonthlyReportData): string {
    const {
        userName, month, year, dashboardUrl,
        totalDebtPending, totalBank, totalArg, totalUSA,
        maturities, previousMonthPassiveIncome, // New
        rentalEvents,
        hasRentals, hasArg, hasUSA, hasBank, hasDebts
    } = data;

    // Metrics for Executive Summary
    const netWorth = totalBank + totalArg + totalUSA + totalDebtPending; // Approximate // Fixed logic if debt is negative? Usually pending is positive asset? Or debt? 
    // Usually 'totalDebtPending' in dashboard data is "Money people owe ME" (Asset). So positive.
    const dateStr = format(new Date(), 'dd MMM yyyy', { locale: es });

    const sortedMaturities = [...maturities].sort((a, b) => a.date.getTime() - b.date.getTime());

    const renderRows = (items: MaturityItem[]) => {
        if (items.length === 0) return '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">Sin movimientos registrados.</td></tr>';

        return items.map((item, idx) => {
            const isUSA = item.type === 'TREASURY';
            const isPF = item.type === 'PF';
            const isRental = item.type === 'RENTAL';
            const bgClass = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

            let typeBadge = `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background-color: #f1f5f9; color: #64748b; letter-spacing: 0.5px;">ARG</span>`;

            if (isUSA) typeBadge = `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background-color: #eff6ff; color: #1e40af; letter-spacing: 0.5px;">USA</span>`;
            if (isPF) typeBadge = `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background-color: #fdf2f8; color: #be185d; letter-spacing: 0.5px;">PLAZO FIJO</span>`;
            if (isRental) typeBadge = `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; background-color: #fff7ed; color: #c2410c; letter-spacing: 0.5px;">RENTA</span>`;

            return `
            <tr style="background-color: ${bgClass};">
                <td style="padding: 12px 16px; color: #475569; font-family: monospace; font-size: 13px;">
                    ${format(item.date, 'dd/MM')}
                </td>
                <td style="padding: 12px 16px;">
                    <div style="color: #0f172a; font-weight: 500; font-size: 14px;">${item.description}</div>
                    <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                        ${typeBadge}
                        ${item.meta ? `<span style="color: #94a3b8; font-size: 11px;">${item.meta}</span>` : ''}
                    </div>
                </td>
                <td style="padding: 12px 16px; text-align: right; color: #0f172a; font-weight: 600; font-family: monospace; font-size: 14px;">
                    ${formatCurrency(item.amount, item.currency)}
                </td>
            </tr>
        `}).join('');
    };

    const renderEvents = () => {
        if (rentalEvents.length === 0) return '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #94a3b8;">No hay eventos próximos.</td></tr>';

        // 1. Sort by date
        const sorted = [...rentalEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 2. Find Next Adjustment and Next Expiration
        const nextAdj = sorted.find(e => e.type === 'ADJUSTMENT');
        const nextExp = sorted.find(e => e.type === 'EXPIRATION');

        // 3. Construct filtered list (Unique singular events)
        const finalEvents = [];
        if (nextAdj) finalEvents.push(nextAdj);
        // Avoid adding duplicated object if same event is both? (Unlikely). 
        // Or if we want to show EXPIRATION even if ADJ is sooner? Yes.
        if (nextExp) finalEvents.push(nextExp);

        // Sort again just to be sure
        finalEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (finalEvents.length === 0) return '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #94a3b8;">No hay ajustes ni vencimientos próximos.</td></tr>';

        return finalEvents.map(e => {
            const isExp = e.type === 'EXPIRATION';
            const color = isExp ? '#dc2626' : '#475569';
            const label = isExp ? 'VENCIMIENTO' : 'AJUSTE';
            return `
                <tr>
                   <td width="70%" align="left" style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">
                        <span style="color: ${color}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">${label}</span>
                        <div style="color: #1e293b; font-weight: 500; margin-top: 4px;">${e.property}</div>
                   </td>
                   <td width="30%" align="right" style="padding: 0; border-bottom: 1px solid #f1f5f9;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td align="right" style="padding: 12px 16px 4px 16px;">
                                    <div style="color: #0f172a; font-weight: 600;">${format(e.date, 'MMM yyyy', { locale: es }).toUpperCase()}</div>
                                </td>
                            </tr>
                            <tr>
                                <td align="right" style="padding: 0 16px 12px 16px;">
                                    <div style="color: #94a3b8; font-size: 11px;">Faltan ${e.monthsTo} meses</div>
                                </td>
                            </tr>
                        </table>
                   </td> 
                </tr>
            `
        }).join('');
    };

    // New: Passive Income Previous Month Section
    const renderPassiveIncome = () => {
        if (!previousMonthPassiveIncome) return '';

        const { monthName, interests, rentals, plazoFijo, debtCollected, total } = previousMonthPassiveIncome;

        // Helper specifically for this table
        const row = (label: string, value: number, isSubItem: boolean = false) => {
            if (value <= 0) return ''; // Hide if 0
            return `
            <tr>
                <td style="padding: 8px 12px; color: ${isSubItem ? '#64748b' : '#334155'}; ${isSubItem ? 'padding-left: 24px;' : 'font-weight: 500;'} font-size: 13px; border-bottom: 1px solid #f1f5f9;">
                    ${label}
                </td>
                <td style="padding: 8px 12px; text-align: right; color: #0f172a; font-family: monospace; font-size: 13px; border-bottom: 1px solid #f1f5f9;">
                    ${formatCurrency(value, 'USD')}
                </td>
            </tr>
            `;
        };

        return `
        <div style="margin-bottom: 32px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
             <div style="background-color: #f1f5f9; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                   💰 Ingresos Pasivos (${monthName})
                </h3>
                <p style="margin: 2px 0 0; color: #64748b; font-size: 11px;">Efectivamente cobrados el mes anterior</p>
             </div>
             <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>
                    ${row('Intereses (Cartera Argentina)', interests.arg, false)}
                    ${row('Intereses (Cartera USA)', interests.usa, false)}
                    ${row('Intereses Plazo Fijo', plazoFijo, false)}
                    ${row('Alquileres Regulares', rentals.regular, false)}
                    ${row('Alquiler Costa Esmeralda', rentals.costa, false)}
                    ${row('Deuda Cobrada', debtCollected, false)}
                </tbody>
                <tfoot style="background-color: #f8fafc; border-top: 2px solid #e2e8f0;">
                    <tr>
                        <td style="padding: 12px 16px; color: #0f172a; font-weight: 700; font-size: 13px; text-transform: uppercase;">Total Cobrado</td>
                        <td style="padding: 12px 16px; text-align: right; color: #059669; font-weight: 700; font-family: monospace; font-size: 15px;">
                            ${formatCurrency(total, 'USD')}
                        </td>
                    </tr>
                </tfoot>
             </table>
        </div>
        `;
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte Financiero ${month} ${year}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <!-- Wrapper -->
    <div style="max-width: 640px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        
        <!-- Header -->
        <div style="background-color: #1e293b; padding: 40px 32px; text-align: center; border-bottom: 4px solid #3b82f6;">
            <div style="display: inline-block; padding: 4px 12px; background-color: rgba(255,255,255,0.1); border-radius: 20px; color: #94a3b8; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                CONFIDENCIAL
            </div>
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: -0.5px;">Estado Mensual</h1>
            <p style="margin: 8px 0 0; color: #cbd5e1; font-size: 15px;">${month.toUpperCase()} ${year}</p>
        </div>

        <!-- Executive Summary -->
        <div style="padding: 32px 32px 0;">
            <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.6;">
                Hola <strong>${userName}</strong>, aquí está el resumen de tu actividad financiera y proyecciones para este período.
            </p>

            <!-- Cards Layout Table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px; border-collapse: separate; border-spacing: 8px 0;">
                <tr>
                    <!-- 1. BANK (Liquidez Only) -->
                    <td width="33%" valign="top" style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Liquidez</div>
                        <div style="color: #0f172a; font-size: 16px; font-weight: 700; margin-top: 6px; letter-spacing: -0.5px;">
                            ${formatCurrency(totalBank, 'USD')}
                        </div>
                    </td>
                    
                    <!-- Spacer -->
                    <td width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>

                    <!-- 2. INVESTMENTS (Arg + USA) -->
                    <td width="33%" valign="top" style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Inversiones</div>
                        <div style="color: #0f172a; font-size: 16px; font-weight: 700; margin-top: 6px; letter-spacing: -0.5px;">
                            ${formatCurrency(totalArg + totalUSA, 'USD')}
                        </div>
                    </td>

                    <!-- Spacer -->
                    <td width="2%" style="font-size: 0; line-height: 0;">&nbsp;</td>

                    <!-- 3. DEBT -->
                    <td width="30%" valign="top" style="background-color: ${totalDebtPending > 0 ? '#ecfdf5' : '#fff1f2'}; padding: 16px; border-radius: 8px; border: 1px solid ${totalDebtPending > 0 ? '#a7f3d0' : '#fecdd3'}; text-align: center;">
                        <div style="color: ${totalDebtPending > 0 ? '#047857' : '#be123c'}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${totalDebtPending > 0 ? 'A Cobrar' : 'Pasivos'}</div>
                        <div style="color: ${totalDebtPending > 0 ? '#065f46' : '#9f1239'}; font-size: 16px; font-weight: 700; margin-top: 6px; letter-spacing: -0.5px;">
                            ${formatCurrency(Math.abs(totalDebtPending), 'USD')}
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Main Content -->
        <div style="padding: 0 32px 32px;">
            
            <!-- NEW: Previous Month Passive Income Details -->
            ${renderPassiveIncome()}

            <!-- New Styled Rentals Box -->
            ${hasRentals ? `
            <div style="margin-bottom: 32px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f1f5f9; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                        🏠 Gestión de Alquileres
                    </h3>
                </div>
                    ${renderEvents()}
                    ${(() => {
                const indecDateStr = getNextIndecReleaseDate();
                if (!indecDateStr) return '';

                const days = getDaysUntilNextRelease();
                const dateObj = new Date(indecDateStr);
                // Move to UTC/Local normalization if needed, but the date string is YYYY-MM-DD
                // Simple parse:
                // We use the same format as above: MMM yyyy or dd/MM?
                // User wants "Próxima publicación".

                return `
                        <tr>
                           <td width="70%" align="left" style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">
                                <span style="color: #0ea5e9; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">INDEC</span>
                                <div style="color: #1e293b; font-weight: 500; margin-top: 4px;">Próximo Dato (IPC)</div>
                           </td>
                           <td width="30%" align="right" style="padding: 0; border-bottom: 1px solid #f1f5f9;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="right" style="padding: 12px 16px 4px 16px;">
                                            <div style="color: #0f172a; font-weight: 600;">${format(dateObj, 'dd MMM yyyy', { locale: es }).toUpperCase()}</div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="right" style="padding: 0 16px 12px 16px;">
                                            <div style="color: #94a3b8; font-size: 11px;">Faltan ${days} días</div>
                                        </td>
                                    </tr>
                                </table>
                           </td> 
                        </tr>
                        `;
            })()} 
                </table>
            </div>
            ` : ''}

            <!-- Cashflow Table -->
            <div>
                 <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                    📅 Vencimientos & Cobros (${month})
                </h3>
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <thead style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th style="text-align: left; padding: 12px 16px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Fecha</th>
                                <th style="text-align: left; padding: 12px 16px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Detalle</th>
                                <th style="text-align: right; padding: 12px 16px; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">USD</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderRows(sortedMaturities)}
                        </tbody>
                        <tfoot style="background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <tr>
                                <td colspan="2" style="padding: 12px 16px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600;">TOTAL DEL MES</td>
                                <td style="padding: 12px 16px; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700;">
                                    ${formatCurrency(sortedMaturities.reduce((sum, i) => sum + i.amount, 0), 'USD')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <!-- CTA -->
            <div style="margin-top: 40px; text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    Ver Dashboard Completo
                </a>
                <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">
                    Información actualizada al ${dateStr}
                </p>
            </div>

        </div>

    </div>

    <!-- Footer -->
    <div style="max-width: 600px; margin: 0 auto 40px; text-align: center;">
        <p style="color: #cbd5e1; font-size: 12px; margin: 0;">
            &copy; ${year} Passive Income Tracker. Private & Confidential.
        </p>
    </div>

</body>
</html>
    `;
}
