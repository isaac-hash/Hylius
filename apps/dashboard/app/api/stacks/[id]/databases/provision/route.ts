import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../../services/auth.service';
import { createDatabase, linkDatabaseToProject } from '../../../../../../services/database.service';
import { addDatabaseToStack, getStack } from '../../../../../../services/stack.service';
// @ts-ignore - Local workspace package
import { DatabaseEngine } from '@hylius/core';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        const body = await request.json();
        const { name, engine, version, linkToProjectIds } = body;

        if (!name || !engine) {
            return NextResponse.json({ error: 'Missing required fields: name, engine' }, { status: 400 });
        }

        // Fetch stack to get serverId
        const stack = await getStack(id, auth.organizationId);
        
        // 1. Provision new database
        const result = await createDatabase({
            serverId: stack.serverId,
            organizationId: auth.organizationId,
            name,
            engine: engine as DatabaseEngine,
            version,
        });

        if (result.error || !result.id) {
            return NextResponse.json({ error: result.error || 'Failed to provision database' }, { status: 500 });
        }

        // 2. Add to stack
        await addDatabaseToStack(id, result.id, auth.organizationId);

        // 3. Link to projects if requested (auto-injects DATABASE_URL/REDIS_URL)
        if (linkToProjectIds && Array.isArray(linkToProjectIds)) {
            for (const projectId of linkToProjectIds) {
                await linkDatabaseToProject(result.id, projectId);
            }
        }

        return NextResponse.json({ success: true, databaseId: result.id });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
