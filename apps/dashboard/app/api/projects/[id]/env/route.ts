import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { requireAuth } from '../../../../../services/auth.service';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/env  — return key/value pairs (values redacted for sensitive keys)
export async function GET(request: Request, { params }: Params) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;

        const project = await prisma.project.findUnique({
            where: { id },
            select: { envVars: true, organizationId: true },
        });

        if (!project || project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        let env: Record<string, string> = {};
        if (project.envVars) {
            try { env = JSON.parse(project.envVars as string); } catch { /* ignore */ }
        }

        // Return entries — mask values that look sensitive (contain "secret", "key", "password", "token")
        const SENSITIVE = /secret|key|password|token|pwd|pass|private/i;
        const entries = Object.entries(env).map(([k, v]) => ({
            key: k,
            value: SENSITIVE.test(k) ? '•'.repeat(Math.min(v.length, 24)) : v,
            masked: SENSITIVE.test(k),
        }));

        return NextResponse.json({ entries });
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/projects/[id]/env  — replace all env vars atomically
// Body: { env: Record<string, string> }
export async function PUT(request: Request, { params }: Params) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        const body = await request.json();
        const incoming: Record<string, string> = body.env ?? {};

        // Validate: keys must be non-empty strings, values must be strings
        for (const [k, v] of Object.entries(incoming)) {
            if (!k || typeof k !== 'string' || k.trim() === '') {
                return NextResponse.json({ error: `Invalid key: "${k}"` }, { status: 400 });
            }
            if (typeof v !== 'string') {
                return NextResponse.json({ error: `Value for "${k}" must be a string` }, { status: 400 });
            }
        }

        const project = await prisma.project.findUnique({
            where: { id },
            select: { organizationId: true, name: true },
        });

        if (!project || project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        await prisma.project.update({
            where: { id },
            data: { envVars: JSON.stringify(incoming) },
        });

        await prisma.auditLog.create({
            data: {
                action: 'PROJECT_ENV_UPDATED',
                organizationId: auth.organizationId,
                metadata: JSON.stringify({ projectId: id, projectName: project.name, keyCount: Object.keys(incoming).length }),
            },
        });

        return NextResponse.json({ success: true, count: Object.keys(incoming).length });
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
