import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../../services/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const repo = searchParams.get('repo');

        if (!repo) {
            return new NextResponse('Missing repo parameter', { status: 400 });
        }

        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new NextResponse('Missing or invalid Authorization header', { status: 401 });
        }

        const tokenString = authHeader.substring(7);
        const hashedToken = crypto.createHash('sha256').update(tokenString).digest('hex');

        // Verify ApiToken
        const apiToken = await prisma.apiToken.findUnique({
            where: { hashedToken },
            include: { organization: true }
        });

        if (!apiToken) {
            return new NextResponse('Invalid API Token', { status: 401 });
        }

        // Find the project matching the repo
        const project = await prisma.project.findFirst({
            where: {
                organizationId: apiToken.organizationId,
                githubRepoFullName: repo
            }
        });

        if (!project) {
            return new NextResponse('Project not found for this repository', { status: 404 });
        }

        // Parse envVars JSON and format as .env string: KEY=VALUE
        let envString = '';
        if (project.envVars) {
            try {
                const parsed = JSON.parse(project.envVars);
                envString = Object.entries(parsed)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n');
            } catch (e) {
                console.warn('[Env Webhook] Failed to parse envVars for project:', project.id);
            }
        }

        return new NextResponse(envString, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error: any) {
        console.error('[Env Webhook] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
