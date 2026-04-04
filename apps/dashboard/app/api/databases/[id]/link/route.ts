import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { linkDatabaseToProject, unlinkDatabaseFromProject } from '@/services/database.service';

async function authorize(req: NextRequest, databaseId: string) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;
    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) return null;
    // @ts-ignore
    const db = await prisma.database.findUnique({ where: { id: databaseId } });
    if (!db || db.organizationId !== session.user.organizationId) return null;
    return { db, session };
}

// ─── POST /api/databases/[id]/link — link to project ────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await authorize(req, id);
    if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

    const body = await req.json();
    const { projectId } = body;
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });

    // Verify project belongs to same org
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.organizationId !== auth.session.user.organizationId) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await linkDatabaseToProject(id, projectId);
    return NextResponse.json({ success: true });
}

// ─── DELETE /api/databases/[id]/link — unlink from project ──────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await authorize(req, id);
    if (!auth) return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });

    await unlinkDatabaseFromProject(id);
    return NextResponse.json({ success: true });
}
