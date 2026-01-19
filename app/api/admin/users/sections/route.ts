import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/users/sections
 * List all users with their special sections (costa, barbosa)
 */
export async function GET() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                appSettings: {
                    select: {
                        enabledSections: true
                    }
                }
            },
            orderBy: { email: 'asc' }
        });

        const usersWithSections = users.map(user => {
            const sections = user.appSettings?.[0]?.enabledSections?.split(',') || [];
            return {
                id: user.id,
                email: user.email,
                name: user.name,
                hasCosta: sections.includes('costa'),
                hasBarbosa: sections.includes('barbosa')
            };
        });

        return NextResponse.json(usersWithSections);
    } catch (error: any) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/users/sections
 * Toggle a special section for a user
 * Body: { userId: string, section: 'costa' | 'barbosa', enabled: boolean }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, section, enabled } = body;

        // Validate input
        if (!userId || !section) {
            return NextResponse.json(
                { error: 'Missing userId or section' },
                { status: 400 }
            );
        }

        if (!['costa', 'barbosa'].includes(section)) {
            return NextResponse.json(
                { error: 'Invalid section. Must be costa or barbosa' },
                { status: 400 }
            );
        }

        // Get or create settings
        let settings = await prisma.appSettings.findUnique({
            where: { userId }
        });

        if (!settings) {
            // Create default settings
            settings = await prisma.appSettings.create({
                data: {
                    userId,
                    enabledSections: enabled ? section : '',
                    reportDay: 1,
                    reportHour: 10
                }
            });
        } else {
            // Update existing settings
            const sections = settings.enabledSections?.split(',').filter(s => s) || [];

            if (enabled) {
                // Add section if not present
                if (!sections.includes(section)) {
                    sections.push(section);
                }
            } else {
                // Remove section
                const index = sections.indexOf(section);
                if (index > -1) {
                    sections.splice(index, 1);
                }
            }

            settings = await prisma.appSettings.update({
                where: { id: settings.id },
                data: { enabledSections: sections.join(',') }
            });
        }

        return NextResponse.json({
            success: true,
            userId,
            section,
            enabled,
            enabledSections: settings.enabledSections
        });
    } catch (error: any) {
        console.error('Error updating user sections:', error);
        return NextResponse.json(
            { error: 'Failed to update sections' },
            { status: 500 }
        );
    }
}
