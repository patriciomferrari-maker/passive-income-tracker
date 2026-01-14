
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

    // Highlights
    rentalEvents: { date: Date; property: string; type: 'ADJUSTMENT' | 'EXPIRATION'; monthsTo: number }[];

    nextPFMaturity?: { date: Date; bank: string; amount: number } | null;

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
        maturities,
        rentalEvents, nextPFMaturity,
        hasRentals, hasArg, hasUSA, hasBank, hasDebts
    } = data;

    // Sort by date
    const sortedMaturities = [...maturities].sort((a, b) => a.date.getTime() - b.date.getTime());

    const renderRows = (items: MaturityItem[]) => {
        if (items.length === 0) return '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No hay movimientos este mes.</td></tr>';

        return items.map(item => {
            const isUSA = item.type === 'TREASURY';
            const isPF = item.type === 'PF';
            const isRental = item.type === 'RENTAL';

            let locationTag = '<span style="background-color: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">ARG</span>';

            if (isUSA) {
                locationTag = '<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">USA</span>';
            } else if (isPF) {
                locationTag = '<span style="background-color: #fce7f3; color: #9d174d; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">PF</span>';
            } else if (isRental) {
                locationTag = '<span style="background-color: #ffedd5; color: #c2410c; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">ALQUILER</span>';
            }

            return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #334155;">
                    ${format(item.date, 'dd/MM', { locale: es })}
                </td>
                <td style="padding: 12px 0; color: #0f172a; font-weight: 500;">
                    <div>${item.description}</div>
                    <div style="margin-top: 4px;">${locationTag}</div>
                </td>
                <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: 600;">
                    ${formatCurrency(item.amount, item.currency)}
                </td>
            </tr>
        `}).join('');
    };

    const renderTotal = (items: MaturityItem[]) => {
        if (items.length === 0) return '';
        const total = items.reduce((sum, i) => sum + i.amount, 0);
        return `
            <tr>
                <td colspan="2" style="padding: 12px 0; text-align: right; color: #64748b; font-size: 13px; text-transform: uppercase;">Total del Mes (USD)</td>
                <td style="padding: 12px 0; text-align: right; color: #0e4166; font-weight: 700;">${formatCurrency(total, 'USD')}</td>
            </tr>
        `;
    };

    // Debt Card Logic
    const isDebtPositive = totalDebtPending >= 0;
    const debtTitle = isDebtPositive ? "Deudas a Cobrar" : "Deudas a Pagar";
    const debtBg = isDebtPositive ? "#ecfdf5" : "#fff1f2"; // emerald-50 vs rose-50
    const debtBorder = isDebtPositive ? "#6ee7b7" : "#fecdd3"; // emerald-300 vs rose-300
    const debtColor = isDebtPositive ? "#059669" : "#be123c"; // emerald-600 vs rose-700

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resumen Mensual</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

    <!-- Main Container -->
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden; font-size: 14px;">
        
        <!-- Header -->
        <div style="background-color: #0e4166; padding: 30px 24px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Resumen Mensual</h1>
            <p style="margin: 5px 0 0; color: #94a3b8; font-size: 14px;">${month.toUpperCase()} ${year}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
            
            <p style="margin: 0 0 24px; color: #334155; font-size: 16px;">
                Hola <strong>${userName}</strong>, este es tu resumen:
            </p>

            <!-- Dynamic Header Cards -->
            ${(() => {
            // 1. Define Potential Cards
            const allCards = [
                {
                    id: 'bank',
                    condition: hasBank && totalBank > 1,
                    label: 'Saldo Banco',
                    value: formatCurrency(totalBank, 'USD'),
                    bg: '#eff6ff', border: '#bfdbfe', colorInfo: '#1e40af', colorVal: '#1e3a8a'
                },
                {
                    id: 'arg',
                    condition: hasArg && totalArg > 1,
                    label: 'Cartera Arg',
                    value: formatCurrency(totalArg, 'USD'),
                    bg: '#f8fafc', border: '#e2e8f0', colorInfo: '#64748b', colorVal: '#0f172a'
                },
                {
                    id: 'usa',
                    condition: hasUSA && totalUSA > 1,
                    label: 'Cartera USA',
                    value: formatCurrency(totalUSA, 'USD'),
                    bg: '#f8fafc', border: '#e2e8f0', colorInfo: '#64748b', colorVal: '#0f172a'
                },
                {
                    id: 'debt',
                    condition: hasDebts && Math.abs(totalDebtPending) > 1,
                    label: debtTitle,
                    value: formatCurrency(totalDebtPending, 'USD'),
                    bg: debtBg, border: debtBorder, colorInfo: debtColor, colorVal: debtColor
                }
            ];

            // 2. Filter Active Cards
            const activeCards = allCards.filter(c => c.condition);

            if (activeCards.length === 0) return '';

            // 3. Render in Rows of 2
            let html = '';
            for (let i = 0; i < activeCards.length; i += 2) {
                const card1 = activeCards[i];
                const card2 = activeCards[i + 1]; // Might be undefined

                html += `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                            <td width="48%" style="background-color: ${card1.bg}; padding: 12px; border-radius: 8px; border: 1px solid ${card1.border}; text-align: center;">
                                <p style="margin: 0; color: ${card1.colorInfo}; font-size: 10px; text-transform: uppercase; font-weight: 600;">${card1.label}</p>
                                <p style="margin: 4px 0 0; color: ${card1.colorVal}; font-size: 15px; font-weight: 700;">${card1.value}</p>
                            </td>
                            <td width="4%"></td>
                            ${card2 ? `
                            <td width="48%" style="background-color: ${card2.bg}; padding: 12px; border-radius: 8px; border: 1px solid ${card2.border}; text-align: center;">
                                <p style="margin: 0; color: ${card2.colorInfo}; font-size: 10px; text-transform: uppercase; font-weight: 600;">${card2.label}</p>
                                <p style="margin: 4px 0 0; color: ${card2.colorVal}; font-size: 15px; font-weight: 700;">${card2.value}</p>
                            </td>
                            ` : `
                            <td width="48%"></td>
                            `}
                        </tr>
                    </table>
                    `;
            }
            return html;
        })()}

            <!-- 2. Vencimientos del Mes (Full Month) -->
            ${maturities.length > 0 ? `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Vencimientos del Mes (${month})</h3>
                </div>
                <div style="padding: 0 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 12px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Fecha</th>
                                <th style="text-align: left; padding: 12px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Concepto</th>
                                <th style="text-align: right; padding: 12px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderRows(sortedMaturities)}
                            ${renderTotal(sortedMaturities)}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}

            <!-- 3. Próximo Plazo Fijo -->
            ${nextPFMaturity ? `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #fce7f3; padding: 12px 16px; border-bottom: 1px solid #fbcfe8;">
                    <h3 style="margin: 0; color: #831843; font-size: 14px; font-weight: 700; text-transform: uppercase;">Próximo Vencimiento Plazo Fijo</h3>
                </div>
                <div style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom: 4px; color: #64748b; font-size: 11px; text-transform: uppercase;">Fecha</td>
                            <td style="padding-bottom: 4px; color: #0f172a; font-weight: 600; text-align: right;">${format(nextPFMaturity.date, 'dd/MM/yyyy')}</td>
                        </tr>
                        <tr>
                            <td style="padding-bottom: 4px; color: #64748b; font-size: 11px; text-transform: uppercase;">Banco</td>
                            <td style="padding-bottom: 4px; color: #0f172a; font-weight: 600; text-align: right;">${nextPFMaturity.bank}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; font-size: 11px; text-transform: uppercase;">Monto</td>
                            <td style="color: #0f172a; font-weight: 700; text-align: right; color: #db2777;">${formatCurrency(nextPFMaturity.amount, 'USD')}</td> <!-- Assuming USD for display consistency, or check currency -->
                        </tr>
                    </table>
                </div>
            </div>` : ''}

            <!-- 4. Alquileres Tables (Prox Ajustes & Vencimientos) -->
             <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Alquileres - Próximos Eventos</h3>
                </div>
                <div style="padding: 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        ${(() => {
            if (rentalEvents.length === 0) {
                return '<tr><td colspan="2" style="text-align: center; color: #94a3b8; font-size: 12px;">No hay eventos de alquiler próximos en 12 meses.</td></tr>';
            }

            // 1. Separate and Sort by Date
            const adjustments = rentalEvents
                .filter(e => e.type === 'ADJUSTMENT')
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const expirations = rentalEvents
                .filter(e => e.type === 'EXPIRATION')
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const targetEvents: typeof rentalEvents = [];

            // 2. Filter: Keep only the closest date's events for Adjustments
            if (adjustments.length > 0) {
                const firstDateStr = format(adjustments[0].date, 'yyyy-MM-dd');
                targetEvents.push(...adjustments.filter(e => format(e.date, 'yyyy-MM-dd') === firstDateStr));
            }

            // 3. Filter: Keep only the closest date's events for Expirations
            if (expirations.length > 0) {
                const firstDateStr = format(expirations[0].date, 'yyyy-MM-dd');
                targetEvents.push(...expirations.filter(e => format(e.date, 'yyyy-MM-dd') === firstDateStr));
            }

            // 4. Group events by date + type (Existing Logic)
            const groupedEvents: { [key: string]: { date: Date, type: string, items: { property: string, monthsTo: number }[] } } = {};

            targetEvents.forEach(event => {
                const dateKey = format(event.date, 'yyyy-MM-dd') + '_' + event.type;
                if (!groupedEvents[dateKey]) {
                    groupedEvents[dateKey] = {
                        date: event.date,
                        type: event.type,
                        items: []
                    };
                }
                groupedEvents[dateKey].items.push({
                    property: event.property,
                    monthsTo: event.monthsTo
                });
            });

            return Object.values(groupedEvents)
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(group => {
                    const isExpiration = group.type === 'EXPIRATION';
                    const label = isExpiration ? 'Vencimiento Contrato' : 'Próximo Ajuste';
                    const color = isExpiration ? '#ef4444' : '#64748b';

                    // Format: "Propiedad A (3 meses), Propiedad B (3 meses)"
                    const propertiesList = group.items.map(i => `<b>${i.property}</b> (${i.monthsTo} meses)`).join(', ');

                    return `
                                    <tr>
                                        <td style="padding-bottom: 8px; color: ${color}; font-size: 12px; font-weight: ${isExpiration ? '600' : '400'}; vertical-align: top; width: 35%">${label}</td>
                                        <td style="padding-bottom: 8px; color: #0f172a; font-weight: 500; text-align: right; vertical-align: top;">
                                            ${format(group.date, 'dd/MM/yyyy')} 
                                            <span style="display:block; color: #64748b; font-size: 11px; line-height: 1.4; margin-top: 2px;">
                                                ${propertiesList}
                                            </span>
                                        </td>
                                    </tr>
                                    `;
                }).join('');
        })()}
                    </table>
                </div>
            </div>
            
            <!-- CTA Button -->
             <div style="text-align: center; margin-top: 32px;">
                <a href="${dashboardUrl}" style="background-color: #0e4166; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Ir al Dashboard Consolidado</a>
                <p style="margin-top: 16px; color: #94a3b8; font-size: 12px;">Para mas información visita tu panel de control.</p>
            </div>

        </div>

    </div>
</body>
</html>
    `;
}
