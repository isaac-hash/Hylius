import { prisma } from './prisma';

interface GlitchtipAuth {
    token: string;
}

export class GlitchtipApiService {
    
    private static async getAuthToken(server: any): Promise<string> {
        if (!server.errorTrackingUrl || !server.errorTrackingToken) {
            throw new Error('Error tracking not configured for server');
        }
        
        // GlitchTip uses the Sentry API format
        // The token is actually our admin password. Let's get an auth token if needed,
        // or just use basic auth if the API accepts it.
        // Actually, let's login to get a session/token.
        const res = await fetch(`${server.errorTrackingUrl}/api/0/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin@hylius.icu',
                password: server.errorTrackingToken
            })
        });

        if (!res.ok) {
            throw new Error('Failed to authenticate with GlitchTip API');
        }

        const data = await res.json();
        // Return the token if available, else we might need to rely on cookies
        // Let's assume GlitchTip provides an auth token or we can use Basic Auth.
        // For simplicity, we'll try to use the user token returned or fallback to Basic Auth.
        return data.token || Buffer.from(`admin@hylius.icu:${server.errorTrackingToken}`).toString('base64');
    }

    private static async request(server: any, endpoint: string, method = 'GET', body?: any) {
        const auth = await this.getAuthToken(server);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // If it's a base64 string, it's Basic, else Bearer
            'Authorization': auth.length > 100 ? `Bearer ${auth}` : `Basic ${auth}`
        };

        const res = await fetch(`${server.errorTrackingUrl}/api/0${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store'
        });

        if (!res.ok) {
            console.error(`GlitchTip API Error (${endpoint}):`, await res.text());
            throw new Error(`GlitchTip API failed: ${res.status}`);
        }

        return res.json();
    }

    /**
     * Ensures an organization and project exists for a given Hylius project.
     * Returns the SENTRY_DSN for the project.
     */
    static async ensureProject(projectId: string): Promise<string | null> {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { server: true }
        });

        if (!project || !project.server || !project.server.hasErrorTracking) {
            return null;
        }

        const server = project.server;
        const orgSlug = 'hylius';
        const projSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // 1. Check if organization exists, if not create
        try {
            await this.request(server, `/organizations/${orgSlug}/`);
        } catch (e) {
            await this.request(server, `/organizations/`, 'POST', {
                name: 'Hylius',
                slug: orgSlug,
                agreeTerms: true
            });
        }

        // 2. Check if project exists, if not create
        try {
            await this.request(server, `/projects/${orgSlug}/${projSlug}/`);
        } catch (e) {
            // Need a team to create a project
            try {
                await this.request(server, `/teams/${orgSlug}/engineers/`);
            } catch (err) {
                await this.request(server, `/organizations/${orgSlug}/teams/`, 'POST', {
                    name: 'Engineers',
                    slug: 'engineers'
                });
            }

            await this.request(server, `/teams/${orgSlug}/engineers/projects/`, 'POST', {
                name: project.name,
                slug: projSlug,
                platform: 'other' // Framework agnostic
            });
        }

        // 3. Get the DSN keys
        const keys = await this.request(server, `/projects/${orgSlug}/${projSlug}/keys/`);
        if (keys && keys.length > 0) {
            // The public DSN
            return keys[0].dsn.public;
        }

        return null;
    }

    /**
     * Fetches unresolved issues for a project.
     */
    static async getIssues(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { server: true }
        });

        if (!project || !project.server || !project.server.hasErrorTracking) {
            return [];
        }

        const orgSlug = 'hylius';
        const projSlug = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        try {
            const issues = await this.request(project.server, `/projects/${orgSlug}/${projSlug}/issues/?query=is:unresolved`);
            return issues;
        } catch (e) {
            return [];
        }
    }
}
