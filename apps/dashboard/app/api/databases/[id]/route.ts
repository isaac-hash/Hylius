/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { deleteDatabase, buildConnectionStringFromRecord } from '@/services/database.service';

async function getAuthenticatedDatabase(req: NextRequest, databaseId: string) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return { error: 'Unauthorized', status: 401 };

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) return { error: 'Unauthorized', status: 401 };

    // @ts-ignore
    const db = await prisma.database.findUnique({
        where: { id: databaseId },
        include: { project: { select: { id: true, name: true } } },
    });
    if (!db) return { error: 'Database not found', status: 404 };
    if (db.organizationId !== session.user.organizationId) return { error: 'Forbidden', status: 403 };

    return { db, session };
}

// ─── GET /api/databases/[id] ─────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const authResult = await getAuthenticatedDatabase(req, id);
    if ('error' in authResult) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { db } = authResult;
    // Build connection string (decrypt password in-memory, never expose passwordEncrypted)
    const connectionString = buildConnectionStringFromRecord(db);
    const { passwordEncrypted: _, passwordIv: __, ...safeDb } = db as any;

    return NextResponse.json({ ...safeDb, connectionString });
}

// ─── DELETE /api/databases/[id] ──────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const authResult = await getAuthenticatedDatabase(req, id);
    if ('error' in authResult) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json().catch(() => ({}));
    const removeVolume = body?.removeVolume === true;

    const result = await deleteDatabase(id, removeVolume);
    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
