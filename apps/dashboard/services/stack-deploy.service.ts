/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { prisma } from './prisma';
import { executeDeployment } from './deploy.service';

export interface StackDeployResult {
    stackId: string;
    success: boolean;
    results: Array<{
        projectId: string;
        projectName: string;
        success: boolean;
        deploymentId?: string;
        url?: string;
        error?: string;
        durationMs?: number;
    }>;
    totalDurationMs: number;
}

export interface StackDeployOptions {
    stackId: string;
    organizationId: string;
    /** Per-service progress callback — called when each service starts/finishes */
    onServiceProgress?: (event: {
        type: 'service_start' | 'service_complete' | 'service_error';
        projectId: string;
        projectName: string;
        index: number;
        total: number;
        success?: boolean;
        error?: string;
        url?: string;
    }) => void;
    /** Real-time log callback */
    onLog?: (chunk: string) => void;
}

/**
 * Deploy all services in a stack sequentially, in the order they were added.
 * No smart ordering — just deploy each project one by one.
 */
export async function deployStack(options: StackDeployOptions): Promise<StackDeployResult> {
    const { stackId, organizationId, onServiceProgress, onLog } = options;
    const startTime = Date.now();
    const log = (msg: string) => { if (onLog) onLog(msg); };

    // Fetch stack with projects (ordered by createdAt = order added)
    // @ts-ignore
    const stack = await prisma.stack.findFirst({
        where: { id: stackId, organizationId },
        include: {
            projects: { orderBy: { createdAt: 'asc' as const } },
            server: { select: { name: true } },
        },
    });

    if (!stack) throw new Error('Stack not found');
    if (stack.projects.length === 0) throw new Error('Stack has no services to deploy');

    // Set stack status to DEPLOYING
    // @ts-ignore
    await prisma.stack.update({
        where: { id: stackId },
        data: { status: 'DEPLOYING' },
    });

    log(`\x1b[36m━━━ Deploying Stack: ${stack.name} (${stack.projects.length} service${stack.projects.length > 1 ? 's' : ''}) ━━━\x1b[0m\n\n`);

    const results: StackDeployResult['results'] = [];
    let hasFailure = false;

    for (let i = 0; i < stack.projects.length; i++) {
        const project = stack.projects[i];

        log(`\x1b[35m┌── Service ${i + 1}/${stack.projects.length}: ${project.name} ──┐\x1b[0m\n`);

        onServiceProgress?.({
            type: 'service_start',
            projectId: project.id,
            projectName: project.name,
            index: i,
            total: stack.projects.length,
        });

        try {
            const result = await executeDeployment({
                projectId: project.id,
                trigger: 'dashboard',
                onLog: (chunk) => log(chunk),
            });

            results.push({
                projectId: project.id,
                projectName: project.name,
                success: result.success,
                deploymentId: result.deploymentId,
                url: result.url,
                error: result.error,
                durationMs: result.durationMs,
            });

            if (result.success) {
                log(`\x1b[32m└── ✅ ${project.name} deployed successfully ──┘\x1b[0m\n\n`);
            } else {
                log(`\x1b[31m└── ❌ ${project.name} failed: ${result.error} ──┘\x1b[0m\n\n`);
                hasFailure = true;
            }

            onServiceProgress?.({
                type: result.success ? 'service_complete' : 'service_error',
                projectId: project.id,
                projectName: project.name,
                index: i,
                total: stack.projects.length,
                success: result.success,
                error: result.error,
                url: result.url,
            });

        } catch (err: any) {
            const errorMsg = err.message || 'Unknown deployment error';
            results.push({
                projectId: project.id,
                projectName: project.name,
                success: false,
                error: errorMsg,
            });
            hasFailure = true;

            log(`\x1b[31m└── ❌ ${project.name} errored: ${errorMsg} ──┘\x1b[0m\n\n`);

            onServiceProgress?.({
                type: 'service_error',
                projectId: project.id,
                projectName: project.name,
                index: i,
                total: stack.projects.length,
                success: false,
                error: errorMsg,
            });
        }
    }

    // Update stack status
    const finalStatus = hasFailure ? 'ERROR' : 'ACTIVE';
    // @ts-ignore
    await prisma.stack.update({
        where: { id: stackId },
        data: { status: finalStatus },
    });

    const totalDurationMs = Date.now() - startTime;

    // Summary log
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    log(`\n\x1b[36m━━━ Stack Deploy Complete: ${successCount}/${results.length} succeeded${failCount > 0 ? `, ${failCount} failed` : ''} (${(totalDurationMs / 1000).toFixed(1)}s) ━━━\x1b[0m\n`);

    // Audit log
    await prisma.auditLog.create({
        data: {
            action: hasFailure ? 'STACK_DEPLOY_PARTIAL' : 'STACK_DEPLOY_COMPLETED',
            organizationId,
            metadata: JSON.stringify({
                stackId,
                stackName: stack.name,
                totalServices: stack.projects.length,
                succeeded: successCount,
                failed: failCount,
                totalDurationMs,
            }),
        },
    });

    return {
        stackId,
        success: !hasFailure,
        results,
        totalDurationMs,
    };
}
