import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { TEMPLATES, TemplateContext } from '../../../../lib/templates';
import { executeDeployment } from '../../../../services/deploy.service';
import { createDatabase } from '../../../../services/database.service';

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const body = await request.json();
        const { templateId, serverId, appName, deployPath, envOverrides = {}, domainHostname } = body;

        if (!templateId || !serverId || !appName || !deployPath) {
            return NextResponse.json(
                { error: 'Missing required fields: templateId, serverId, appName, deployPath' },
                { status: 400 }
            );
        }

        const template = TEMPLATES.find(t => t.id === templateId);
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        const server = await prisma.server.findFirst({
            where: { id: serverId, organizationId: auth.organizationId },
        });

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        const ctx: TemplateContext = {
            appName,
            extraEnv: envOverrides,
        };

        // Provision databases if needed
        const linkedDatabaseIds: string[] = [];

        if (template.requiresDatabase && template.requiresDatabase.length > 0) {
            for (const engine of template.requiresDatabase) {
                const dbName = `${appName}-${engine.toLowerCase()}`;
                
                // createDatabase provisions DB remotely and stores in Prisma
                const { id, error } = await createDatabase({
                    serverId,
                    organizationId: auth.organizationId,
                    engine,
                    name: dbName,
                });

                if (error || !id) {
                    return NextResponse.json({ error: `Failed to provision ${engine} database: ${error}` }, { status: 500 });
                }

                linkedDatabaseIds.push(id);

                // Fetch the new DB to get its generated credentials
                const newDb = await prisma.database.findUnique({ where: { id } });
                if (newDb) {
                    ctx.dbHost = newDb.containerName || undefined;
                    ctx.dbName = newDb.dbName || undefined;
                    ctx.dbUser = newDb.dbUser || undefined;
                    
                    if (newDb.passwordEncrypted && newDb.passwordIv) {
                        const { decrypt } = await import('../../../../services/crypto.service');
                        ctx.dbPassword = decrypt(newDb.passwordEncrypted, newDb.passwordIv);
                    }

                    // Auto-inject standard framework DB env vars for repository-based templates
                    if (!template.generateCompose && template.repository) {
                        envOverrides['DB_CONNECTION'] = engine === 'POSTGRES' ? 'pgsql' : 'mysql';
                        envOverrides['DB_HOST'] = ctx.dbHost;
                        envOverrides['DB_PORT'] = engine === 'POSTGRES' ? '5432' : '3306';
                        envOverrides['DB_DATABASE'] = ctx.dbName;
                        envOverrides['DB_USERNAME'] = ctx.dbUser;
                        envOverrides['DB_PASSWORD'] = ctx.dbPassword;
                    }
                }
            }
        }

        // Add explicit overrides
        Object.assign(ctx, envOverrides);

        const projectEnv = { ...envOverrides };

        let repoUrl = `template:${template.id}`;
        let branch = 'main';
        let deployStrategy = 'auto';

        if (template.generateCompose) {
            const composeYaml = template.generateCompose(ctx);
            projectEnv._HYLIUS_TEMPLATE_COMPOSE_ = composeYaml;
            deployStrategy = 'docker-compose';
        } else if (template.repository) {
            repoUrl = template.repository.url;
            branch = template.repository.branch || 'main';
        } else {
            return NextResponse.json({ error: 'Template missing valid deployment strategy (compose or repository)' }, { status: 400 });
        }

        // Create Project
        const project = await prisma.project.create({
            data: {
                name: appName,
                repoUrl,
                branch,
                deployPath,
                deployStrategy: deployStrategy as any,
                isTemplate: true,
                templateId: template.id,
                serverId,
                organizationId: auth.organizationId,
                envVars: JSON.stringify(projectEnv),
            },
        });

        // Link databases
        if (linkedDatabaseIds.length > 0) {
            for (const dbId of linkedDatabaseIds) {
                await prisma.database.update({
                    where: { id: dbId },
                    data: { projectId: project.id },
                });
            }
        }

        // Add domain if present
        if (domainHostname) {
            await prisma.domain.create({
                data: {
                    hostname: domainHostname,
                    projectId: project.id,
                }
            });
        }

        // Log the action
        await prisma.auditLog.create({
            data: {
                action: 'PROJECT_CREATED_FROM_TEMPLATE',
                organizationId: auth.organizationId,
                metadata: JSON.stringify({ projectId: project.id, templateId: template.id })
            }
        });

        // Start deployment (does not await so API responds quickly, UI connects to socket)
        executeDeployment({
            projectId: project.id,
            trigger: 'dashboard',
        }).catch(err => console.error('Template deployment failed:', err));

        // Return early so frontend can redirect to deployment page
        // Wait, we need deploymentId to redirect! executeDeployment returns it but it creates it internally.
        // Let's create the deployment record here to return the ID immediately, or await executeDeployment?
        // await executeDeployment takes a long time. 
        // deploy.service.ts creates a deployment inside executeDeployment. We should pre-create it!
        // But executeDeployment doesn't accept a deploymentId. It creates one.
        // So we Must start it and find the PENDING deployment...
        // Actually, we can just await it up to the point it creates... 
        // But standard in this repo: executeDeployment creates deployment and returns it. We can't return immediately if we want to show the specific deployment.
        // Wait, looking at apps/dashboard/app/api/deployments/route.ts, people can just query the latest deployment for this project.
        
        return NextResponse.json({ projectId: project.id });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
