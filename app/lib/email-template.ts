
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
    totalNetWorth: number;
    monthlyIncome: number;
    maturities: MaturityItem[];
}

export function generateMonthlyReportEmail(data: MonthlyReportData): string {
    const { userName, month, year, totalNetWorth, monthlyIncome, maturities } = data;

    // Filter maturities
    const today = new Date();
    // Start of next week (approx 7 days from now)
    const nextWeekBoundary = new Date(today);
    nextWeekBoundary.setDate(today.getDate() + 7);

    const thisWeek = maturities.filter(m => m.date >= today && m.date < nextWeekBoundary);
    const restOfMonth = maturities.filter(m => m.date >= nextWeekBoundary);

    // Sort
    thisWeek.sort((a, b) => a.date.getTime() - b.date.getTime());
    restOfMonth.sort((a, b) => a.date.getTime() - b.date.getTime());

    const totalMaturities = maturities.reduce((sum, m) => sum + (m.currency === 'USD' ? m.amount : 0), 0); // Approx sum assuming USD mainly

    // Helper to render table rows
    const renderRows = (items: MaturityItem[]) => {
        if (items.length === 0) return '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #64748b;">No hay vencimientos en este período.</td></tr>';

        return items.map(item => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 0; color: #334155;">
                    ${format(item.date, 'EEEE dd-MM', { locale: es })}
                </td>
                <td style="padding: 12px 0; color: #0f172a; font-weight: 500;">
                    ${item.description}
                </td>
                <td style="padding: 12px 0; text-align: right; color: #0f172a; font-weight: 600;">
                    ${formatCurrency(item.amount, item.currency)}
                </td>
            </tr>
        `).join('');
    };

    const renderTotal = (items: MaturityItem[]) => {
        if (items.length === 0) return '';
        // Approximate total in displayed currency (simple sum specific to the visual)
        // In a real multi-currency app this is tricky. We'll sum USD for simplicity or just show count.
        // Let's just sum the amounts regardless of currency for the visual if they match, effectively assuming simplified view
        const total = items.reduce((sum, i) => sum + i.amount, 0);
        return `
            <tr>
                <td colspan="2" style="padding: 12px 0; text-align: right; color: #64748b; font-size: 13px; text-transform: uppercase;">Total</td>
                <td style="padding: 12px 0; text-align: right; color: #0e4166; font-weight: 700;">${formatCurrency(total, items[0]?.currency || 'USD')}</td>
            </tr>
        `;
    }

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
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Resumen de Vencimientos</h1>
            <p style="margin: 5px 0 0; color: #94a3b8; font-size: 14px;">${month.toUpperCase()} ${year}</p>
        </div>

        <!-- Content -->
        <div style="padding: 32px 24px;">
            
            <p style="margin: 0 0 24px; color: #334155; font-size: 16px;">
                Hola <strong>${userName}</strong>,<br>
                A continuación el detalle de tus vencimientos e ingresos para este mes.
            </p>

            <!-- Dashboard Summary Cards (Grid) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                    <td width="48%" style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Patrimonio Total</p>
                        <p style="margin: 4px 0 0; color: #10b981; font-size: 20px; font-weight: 700;">${formatCurrency(totalNetWorth, 'USD')}</p>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Ingresos Mes</p>
                        <p style="margin: 4px 0 0; color: #0e4166; font-size: 20px; font-weight: 700;">${formatCurrency(monthlyIncome, 'USD')}</p>
                    </td>
                </tr>
            </table>

            <!-- Section: This Week -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Vencimientos Próximos (7 Días)</h3>
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
                            ${renderRows(thisWeek)}
                            ${renderTotal(thisWeek)}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section: Rest of Month -->
             <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #0e4166; font-size: 14px; font-weight: 700; text-transform: uppercase;">Resto del Mes</h3>
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
                            ${renderRows(restOfMonth)}
                             ${renderTotal(restOfMonth)}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 24px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Generado automáticamente por Passive Income Tracker</p>
        </div>

    </div>
</body>
</html>
    `;
}
