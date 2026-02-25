import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from './prisma';

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Password Helpers ───────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ─── Session Management ─────────────────────────────────────

export async function createSession(userId: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const session = await prisma.session.create({
        data: {
            userId,
            token,
            expiresAt,
        },
    });

    return { token: session.token, expiresAt: session.expiresAt };
}

export async function validateSession(token: string) {
    const session = await prisma.session.findUnique({
        where: { token },
        include: {
            user: {
                include: {
                    organization: true,
                },
            },
        },
    });

    if (!session) return null;

    // Check expiration
    if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: session.id } });
        return null;
    }

    // Check if user is active
    if (!session.user.isActive) {
        throw new Error('Account deactivated');
    }

    // Check if organization is active
    if (session.user.organization && !session.user.organization.isActive) {
        throw new Error('Organization deactivated');
    }

    return session.user;
}

// ─── Auth Context Extraction ────────────────────────────────

export interface AuthContext {
    userId: string;
    email: string;
    role: string;
    organizationId: string | null;
}

/**
 * Extract auth context from a request.
 * Expects: `Authorization: Bearer <session-token>`
 */
export async function getAuthContext(request: Request): Promise<AuthContext | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const user = await validateSession(token);
    if (!user) return null;

    return {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
    };
}

/**
 * Require auth context — throws if not authenticated.
 * Use in API routes.
 */
export async function requireAuth(request: Request): Promise<AuthContext> {
    const ctx = await getAuthContext(request).catch(err => {
        if (err.message === 'Account deactivated' || err.message === 'Organization deactivated') {
            throw err;
        }
        return null;
    });

    if (!ctx) {
        throw new Error('Unauthorized');
    }
    return ctx;
}

/**
 * Require PLATFORM_ADMIN role — throws if not authorized.
 */
export async function requirePlatformAdmin(request: Request): Promise<AuthContext> {
    const ctx = await requireAuth(request);
    if (ctx.role !== 'PLATFORM_ADMIN') {
        throw new Error('Forbidden: Platform Admin access required');
    }
    return ctx;
}

export const AuthService = {
    hashPassword,
    verifyPassword,
    createSession,
    validateSession,
    getAuthContext,
    requireAuth,
    requirePlatformAdmin,
};
