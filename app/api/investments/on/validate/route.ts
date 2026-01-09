import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

/**
 * VALIDATION ENDPOINT
 * Checks consistency between Dashboard and Tenencia (Positions) calculations
 * 
 * Rules to validate:
 * 1. Dashboard "Inversión Total" must equal Positions total "Valor Compra" (USD)
 * 2. Dashboard "Valor Actual" must equal Positions total "Valor Actual" (USD)
 * 3. Currency conversions must use actual currency fields (cashflow.currency, transaction.currency)
 */
export async function GET(request: Request) {
    try {
        const userId = await getUserId();

        // Fetch Dashboard data
        const dashboardRes = await fetch(new URL('/api/investments/on/dashboard', request.url).toString(), {
            headers: { cookie: request.headers.get('cookie') || '' }
        });
        const dashboardData = await dashboardRes.json();

        // Fetch Positions data
        const positionsUrl = new URL('/api/investments/positions', request.url);
        positionsUrl.searchParams.set('market', 'ARG');
        positionsUrl.searchParams.set('currency', 'USD');
        const positionsRes = await fetch(positionsUrl.toString(), {
            headers: { cookie: request.headers.get('cookie') || '' }
        });
        const positions = await positionsRes.json();

        // Calculate expected values from Positions (source of truth)
        const expectedInversion = positions.reduce((sum: number, p: any) =>
            sum + (p.quantity * p.buyPrice + p.buyCommission), 0
        );
        const expectedValorActual = positions.reduce((sum: number, p: any) =>
            sum + (p.quantity * (p.sellPrice || 0) || 0), 0
        );

        // Get actual values from Dashboard
        const actualInversion = dashboardData.capitalInvertido || 0;
        const actualValorActual = dashboardData.totalCurrentValue || 0;

        // Calculate differences (allow 0.01 tolerance for floating point)
        const inversionDiff = Math.abs(expectedInversion - actualInversion);
        const valorActualDiff = Math.abs(expectedValorActual - actualValorActual);

        const isValid = inversionDiff < 0.01 && valorActualDiff < 0.01;

        const validation = {
            isValid,
            timestamp: new Date().toISOString(),
            checks: [
                {
                    name: 'Inversión Total (Dashboard vs Tenencia)',
                    expected: expectedInversion,
                    actual: actualInversion,
                    diff: inversionDiff,
                    passed: inversionDiff < 0.01
                },
                {
                    name: 'Valor Actual (Dashboard vs Tenencia)',
                    expected: expectedValorActual,
                    actual: actualValorActual,
                    diff: valorActualDiff,
                    passed: valorActualDiff < 0.01
                }
            ],
            warnings: []
        };

        // Add warnings if needed
        if (inversionDiff >= 0.01) {
            validation.warnings.push(`Dashboard Inversión Total ($${actualInversion.toFixed(2)}) differs from Tenencia ($${expectedInversion.toFixed(2)}) by $${inversionDiff.toFixed(2)}`);
        }
        if (valorActualDiff >= 0.01) {
            validation.warnings.push(`Dashboard Valor Actual ($${actualValorActual.toFixed(2)}) differs from Tenencia ($${expectedValorActual.toFixed(2)}) by $${valorActualDiff.toFixed(2)}`);
        }

        return NextResponse.json(validation);
    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json({
            isValid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
