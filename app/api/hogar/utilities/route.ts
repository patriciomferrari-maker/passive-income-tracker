
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // fetch latest check per property per service
        // Since we can't easily doing "DISTINCT ON" in prisma without raw query, we'll fetch manual grouping or raw.
        // Or better: Fetch all properties for user, and for each property fetch the latest check of each type.

        const properties = await prisma.property.findMany({
            where: { userId },
            include: {
                utilityChecks: {
                    orderBy: { checkDate: 'desc' },
                    take: 10 // Take recent ones to filter in code
                }
            }
        });

        const statusMap = properties.map(p => {
            // Group by service type
            const latestByType: Record<string, any> = {};
            p.utilityChecks.forEach(check => {
                const key = check.serviceType + (check.accountNumber || '');
                if (!latestByType[key]) {
                    latestByType[key] = check;
                }
            });

            return {
                id: p.id,
                name: p.name,
                checks: Object.values(latestByType)
            };
        }).filter(p => p.checks.length > 0 || (properties.find(prop => prop.id === p.id && (prop.gasId || prop.electricityId || prop.municipalId))));

        return NextResponse.json({ success: true, data: statusMap });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
