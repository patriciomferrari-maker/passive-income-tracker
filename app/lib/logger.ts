import { prisma } from "@/lib/prisma";

export type AuditAction =
    | 'CREATE_INVESTMENT'
    | 'UPDATE_INVESTMENT'
    | 'DELETE_INVESTMENT'
    | 'CREATE_DIVIDEND'
    | 'UPDATE_DIVIDEND'
    | 'DELETE_DIVIDEND'
    | 'LOGIN_ATTEMPT'
    | 'SYSTEM_ERROR';

/**
 * Log a user action to the database for audit purposes.
 * This is "fire and forget" - it does not block the response if DB fails.
 */
export async function logAccess(
    userId: string | null,
    action: AuditAction,
    resource: string,
    details?: any,
    ip?: string
) {
    try {
        // We use prisma.accessLog if it exists, matching the schema
        // model AccessLog { id, userId?, action, resource, details, ip, createdAt }
        await prisma.accessLog.create({
            data: {
                userId: userId || undefined,
                action,
                resource, // URL or Resource ID
                details: details ? JSON.stringify(details) : undefined,
                ip: ip || 'unknown'
            }
        });
    } catch (error) {
        // Silent failure to avoid breaking the main app flow
        console.error(`[AUDIT FAIL] Failed to log ${action}:`, error);
    }
}
