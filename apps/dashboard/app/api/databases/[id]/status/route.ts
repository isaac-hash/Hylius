import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { refreshDatabaseStatus } from '@/services/database.service';

// ─── GET /api/databases/[id]/status ──────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id } });
    if (!db || db.organizationId !== session.user.organizationId) {
        return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    const status = await refreshDatabaseStatus(id);
    return NextResponse.json(status);
}
