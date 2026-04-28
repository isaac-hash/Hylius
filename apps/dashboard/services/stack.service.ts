/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { prisma } from './prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateStackOptions {
    name: string;
    description?: string;
    serverId: string;
    organizationId: string;
}

export interface UpdateStackOptions {
    name?: string;
    description?: string;
    status?: string;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new Stack on a specific server.
 */
export async function createStack(options: CreateStackOptions) {
    const { name, description, serverId, organizationId } = options;

    // Verify server belongs to the same org
    const server = await prisma.server.findFirst({
        where: { id: serverId, organizationId },
    });
    if (!server) throw new Error('Server not found or does not belong to your organization');

    // @ts-ignore
    const stack = await prisma.stack.create({
        data: {
            name,
            description: description || null,
            serverId,
            organizationId,
        },
        include: {
            server: { select: { id: true, name: true, ip: true } },
        },
    });

    await prisma.auditLog.create({
        data: {
            action: 'STACK_CREATED',
            organizationId,
            metadata: JSON.stringify({ stackId: stack.id, name, serverId }),
        },
    });

    return stack;
}

/**
 * Get a stack with its services (projects) and databases.
 */
export async function getStack(stackId: string, organizationId: string) {
    // @ts-ignore
    const stack = await prisma.stack.findFirst({
        where: { id: stackId, organizationId },
        include: {
            server: { select: { id: true, name: true, ip: true, status: true } },
            projects: {
                include: {
                    deployments: {
                        orderBy: { startedAt: 'desc' as const },
                        take: 1,
                        select: {
                            id: true,
                            status: true,
                            deployUrl: true,
                            startedAt: true,
                            finishedAt: true,
                        },
                    },
                    _count: { select: { deployments: true } },
                },
                orderBy: { createdAt: 'asc' as const },
            },
            databases: {
                orderBy: { createdAt: 'asc' as const },
            },
        },
    });

    if (!stack) throw new Error('Stack not found');
    return stack;
}

/**
 * List all stacks for an organization.
 */
export async function getStacks(organizationId: string) {
    // @ts-ignore
    return prisma.stack.findMany({
        where: { organizationId },
        include: {
            server: { select: { id: true, name: true, ip: true } },
            _count: { select: { projects: true, databases: true } },
        },
        orderBy: { createdAt: 'desc' as const },
    });
}

/**
 * Update a stack's name, description, or status.
 */
export async function updateStack(stackId: string, organizationId: string, data: UpdateStackOptions) {
    // @ts-ignore
    const stack = await prisma.stack.findFirst({
        where: { id: stackId, organizationId },
    });
    if (!stack) throw new Error('Stack not found');

    // @ts-ignore
    return prisma.stack.update({
        where: { id: stackId },
        data,
    });
}

/**
 * Delete a stack. Unlinks all projects and databases — does NOT destroy them.
 */
export async function deleteStack(stackId: string, organizationId: string) {
    // @ts-ignore
    const stack = await prisma.stack.findFirst({
        where: { id: stackId, organizationId },
        include: { projects: true, databases: true },
    });
    if (!stack) throw new Error('Stack not found');

    // Unlink all projects from the stack
    // @ts-ignore
    await prisma.project.updateMany({
        // @ts-ignore
        where: { stackId },
        // @ts-ignore
        data: { stackId: null },
    });

    // Unlink all databases from the stack
    // @ts-ignore
    await prisma.database.updateMany({
        // @ts-ignore
        where: { stackId },
        // @ts-ignore
        data: { stackId: null },
    });

    // Delete the stack record
    // @ts-ignore
    await prisma.stack.delete({ where: { id: stackId } });

    await prisma.auditLog.create({
        data: {
            action: 'STACK_DELETED',
            organizationId,
            metadata: JSON.stringify({ stackId, name: stack.name }),
        },
    });
}

// ─── Service Management ───────────────────────────────────────────────────────

/**
 * Add an existing project to a stack.
 * Validates that the project is on the same server as the stack.
 */
export async function addProjectToStack(stackId: string, projectId: string, organizationId: string) {
    // @ts-ignore
    const stack = await prisma.stack.findFirst({
        where: { id: stackId, organizationId },
    });
    if (!stack) throw new Error('Stack not found');

    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
    });
    if (!project) throw new Error('Project not found');

    if (project.serverId !== stack.serverId) {
        throw new Error('Project must be on the same server as the stack');
    }

    if ((project as any).stackId) {
        throw new Error('Project is already part of a stack. Remove it first.');
    }

    // @ts-ignore
    await prisma.project.update({
        where: { id: projectId },
        // @ts-ignore
        data: { stackId },
    });
}

/**
 * Remove a project from a stack (unlinks, does not delete).
 */
export async function removeProjectFromStack(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
    });
    if (!project) throw new Error('Project not found');

    // @ts-ignore
    await prisma.project.update({
        where: { id: projectId },
        // @ts-ignore
        data: { stackId: null },
    });
}

// ─── Database Management ──────────────────────────────────────────────────────

/**
 * Add an existing managed database to a stack.
 */
export async function addDatabaseToStack(stackId: string, databaseId: string, organizationId: string) {
    // @ts-ignore
    const stack = await prisma.stack.findFirst({
        where: { id: stackId, organizationId },
    });
    if (!stack) throw new Error('Stack not found');

    // @ts-ignore
    const db = await prisma.database.findFirst({
        where: { id: databaseId, organizationId },
    });
    if (!db) throw new Error('Database not found');

    if (db.serverId !== stack.serverId) {
        throw new Error('Database must be on the same server as the stack');
    }

    if ((db as any).stackId) {
        throw new Error('Database is already part of a stack. Remove it first.');
    }

    // @ts-ignore
    await prisma.database.update({
        where: { id: databaseId },
        // @ts-ignore
        data: { stackId },
    });
}

/**
 * Remove a database from a stack (unlinks, does not delete/destroy).
 */
export async function removeDatabaseFromStack(databaseId: string, organizationId: string) {
    // @ts-ignore
    const db = await prisma.database.findFirst({
        where: { id: databaseId, organizationId },
    });
    if (!db) throw new Error('Database not found');

    // @ts-ignore
    await prisma.database.update({
        where: { id: databaseId },
        // @ts-ignore
        data: { stackId: null },
    });
}
