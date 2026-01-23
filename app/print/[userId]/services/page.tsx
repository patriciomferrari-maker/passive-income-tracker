import { prisma } from '@/lib/prisma';
import ServicesDashboardPrint from './ServicesDashboardPrint';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ secret?: string }>;
}

async function getServicesData(userId: string) {
    const properties = await prisma.property.findMany({
        where: {
            userId,
            OR: [
                { gasId: { not: null } },
                { electricityId: { not: null } },
                { aysaId: { not: null } },
                { municipalId: { not: null } },
                { garageMunicipalId: { not: null } }
            ]
        },
        include: {
            utilityChecks: {
                orderBy: { checkDate: 'desc' },
                take: 10 // Get recent checks for each property
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    return properties.map(prop => {
        // Get latest check for each service type
        const getLatestCheck = (serviceType: string) => {
            return prop.utilityChecks.find(c => c.serviceType === serviceType);
        };

        return {
            id: prop.id,
            name: prop.name,
            jurisdiction: prop.jurisdiction,
            gasId: prop.gasId,
            electricityId: prop.electricityId,
            aysaId: prop.aysaId,
            municipalId: prop.municipalId,
            garageMunicipalId: prop.garageMunicipalId,
            hasGarage: prop.hasGarage,
            checks: {
                gas: getLatestCheck('GAS'),
                electricity: getLatestCheck('ELECTRICITY'),
                aysa: getLatestCheck('AYSA'),
                municipal: getLatestCheck('MUNICIPAL'),
                garageMunicipal: getLatestCheck('GARAGE_MUNICIPAL')
            }
        };
    });
}

export default async function PrintServicesPage({ params, searchParams }: PageProps) {
    const { userId } = await params;
    const { secret } = await searchParams;

    if (secret !== process.env.CRON_SECRET) {
        return <div className="text-red-500 p-8">Unauthorized</div>;
    }

    const servicesData = await getServicesData(userId);

    return <ServicesDashboardPrint servicesData={servicesData} />;
}
