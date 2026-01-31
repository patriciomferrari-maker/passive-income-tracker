import { handlers } from "@/auth";
import { rateLimit } from "@/app/lib/rate-limit";
import { NextResponse } from "next/server";

// 5 attempts per minute per IP
const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 500
});

async function wrappedPOST(req: Request) {
    try {
        const ip = req.headers.get('x-forwarded-for') || 'unknown';
        await limiter.check(5, ip); // 5 requests per minute
        return handlers.POST(req);
    } catch {
        return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }
}

export const { GET } = handlers;
export const POST = wrappedPOST;
