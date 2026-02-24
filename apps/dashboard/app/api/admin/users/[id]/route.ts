import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { AuthService } from '../../../../../services/auth.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await AuthService.requirePlatformAdmin(request);
        const { id } = await params;

        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                organization: {
                    include: {
                        _count: {
                            select: {
                                projects: true,
                                servers: true,
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        sessions: true,
                    }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Fetch additional data if user belongs to an org
        let deploymentsCount = 0;
        let servers: any[] = [];
        let projects: any[] = [];

        if (user.organizationId) {
            [deploymentsCount, servers, projects] = await Promise.all([
                prisma.deployment.count({
                    where: { project: { organizationId: user.organizationId } }
                }),
                prisma.server.findMany({
                    where: { organizationId: user.organizationId },
                    select: { id: true, name: true, ip: true, createdAt: true }
                }),
                prisma.project.findMany({
                    where: { organizationId: user.organizationId },
                    select: { id: true, name: true, createdAt: true }
                })
            ]);
        }

        return NextResponse.json({
            user,
            stats: {
                deploymentsCount,
                serversCount: servers.length,
                projectsCount: projects.length,
            },
            servers,
            projects
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message === 'Forbidden: Platform Admin access required') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await AuthService.requirePlatformAdmin(request);
        const { id } = await params;
        const { isActive } = await request.json();

        if (typeof isActive !== 'boolean') {
            return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { isActive }
        });

        return NextResponse.json(user);
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message === 'Forbidden: Platform Admin access required') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
