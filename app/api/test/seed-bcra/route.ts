import { NextResponse } from 'next/server';
import { seedEconomicData } from '@/scripts/legacy/seed-economic-data';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint para probar la carga de datos históricos
 * Acceder desde: http://localhost:3000/api/test/seed-bcra
 */
export async function GET() {
    try {
        console.log('🧪 Test: Iniciando carga de datos BCRA...');

        await seedEconomicData();

        console.log('✅ Test completado');

        return NextResponse.json({
            success: true,
            message: 'Datos históricos cargados correctamente',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Error en test:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
