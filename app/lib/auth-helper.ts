import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function getUserId() {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }
    return session.user.id;
}

export function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
