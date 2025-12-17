import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export async function GET() {
    try {
        const userId = await getUserId();

        let settings = await prisma.appSettings.findUnique({
            where: { userId }
        });

        if (!settings) {
            // Create default settings for this user if not exist
            const newSettings = await prisma.appSettings.create({
                data: {
                    userId,
                    notificationEmails: "",
                    reportDay: 1,
                    reportHour: 10,
                    enabledSections: ""
                },
                include: { user: true }
            });
            // Return here to avoid type mess
            return NextResponse.json({
                ...newSettings,
                email: newSettings.user?.email
            });
        }

        // Refetch with user included if it exists (to get the email)
        const settingsWithUser = await prisma.appSettings.findUnique({
            where: { userId },
            include: { user: true }
        });

        return NextResponse.json({
            ...settingsWithUser,
            email: settingsWithUser?.user?.email
        });
    } catch (e) {
        return unauthorized();
    }
}

export async function PUT(req: Request) {
    try {
        const userId = await getUserId();
        const body = await req.json();
        const { notificationEmails, reportDay, reportHour, enabledSections } = body;

        // Validation
        if (reportDay < 1 || reportDay > 28) {
            return NextResponse.json({ error: 'Day must be between 1 and 28' }, { status: 400 });
        }
        if (reportHour !== undefined && (reportHour < 0 || reportHour > 23)) {
            return NextResponse.json({ error: 'Hour must be between 0 and 23' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        const ADMIN_EMAIL = 'patriciomferrari@gmail.com';

        let cleanEnabledSections = enabledSections || '';

        // Sanitize restricted sections if not admin
        if (user?.email !== ADMIN_EMAIL) {
            const sections = cleanEnabledSections.split(',');
            const filtered = sections.filter((s: string) => s !== 'barbosa' && s !== 'costa' && s !== 'costa-esmeralda');
            cleanEnabledSections = filtered.join(',');
        }

        const settings = await prisma.appSettings.upsert({
            where: { userId },
            update: {
                notificationEmails,
                reportDay,
                reportHour: reportHour || 10,
                enabledSections: cleanEnabledSections
            },
            create: {
                userId,
                notificationEmails,
                reportDay,
                reportHour: reportHour || 10,
                enabledSections: cleanEnabledSections
            }
        });

        return NextResponse.json(settings);
    } catch (e) {
        return unauthorized();
    }
}
