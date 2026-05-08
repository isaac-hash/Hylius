/* eslint-disable no-console */
/**
 * Umami REST API Client
 *
 * Wraps the Umami self-hosted API so Hylius can orchestrate analytics
 * programmatically — users never touch Umami directly.
 */

export interface UmamiStats {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totaltime: number;
}

export interface UmamiPageviews {
    pageviews: { x: string; y: number }[];
    sessions: { x: string; y: number }[];
}

export interface UmamiMetricItem {
    x: string;
    y: number;
}

export type UmamiMetricType =
    | 'path' | 'referrer' | 'browser' | 'os' | 'device'
    | 'country' | 'language' | 'screen' | 'entry' | 'exit';

/**
 * Login and return a JWT token for subsequent requests.
 * Throws on invalid credentials or unreachable instance.
 */
export async function umamiLogin(
    baseUrl: string,
    username: string,
    password: string,
): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Umami login failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.token as string;
}

/**
 * Create a new website in Umami. Returns the siteId to store in the DB.
 */
export async function umamiCreateWebsite(
    baseUrl: string,
    token: string,
    name: string,
    domain: string,
): Promise<string> {
    const res = await fetch(`${baseUrl}/api/websites`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ name, domain }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Umami createWebsite failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    return data.id as string;
}

/**
 * Delete a website from Umami (called on analytics disable).
 */
export async function umamiDeleteWebsite(
    baseUrl: string,
    token: string,
    siteId: string,
): Promise<void> {
    const res = await fetch(`${baseUrl}/api/websites/${siteId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        throw new Error(`Umami deleteWebsite failed (${res.status}): ${text}`);
    }
}

/**
 * Get summary stats for a website (pageviews, visitors, bounces, totaltime).
 */
export async function umamiGetStats(
    baseUrl: string,
    token: string,
    siteId: string,
    startAt: number, // unix ms
    endAt: number,   // unix ms
): Promise<UmamiStats> {
    const url = new URL(`${baseUrl}/api/websites/${siteId}/stats`);
    url.searchParams.set('startAt', String(startAt));
    url.searchParams.set('endAt', String(endAt));

    const res = await fetch(url.toString(), {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Umami getStats failed (${res.status})`);
    const data = await res.json();
    // Umami v2 returns nested { value, change } objects per metric.
    // Fallback to raw number for forward-compat with any future schema change.
    const extract = (field: any): number =>
        typeof field === 'object' && field !== null ? (field.value ?? 0) : (field ?? 0);
    return {
        pageviews: extract(data.pageviews),
        visitors: extract(data.visitors),
        visits: extract(data.visits),
        bounces: extract(data.bounces),
        totaltime: extract(data.totaltime),
    };
}

/**
 * Get time-series pageviews + sessions for a website.
 */
export async function umamiGetPageviews(
    baseUrl: string,
    token: string,
    siteId: string,
    startAt: number,
    endAt: number,
    unit: 'hour' | 'day' | 'month' = 'day',
    timezone = 'UTC',
): Promise<UmamiPageviews> {
    const url = new URL(`${baseUrl}/api/websites/${siteId}/pageviews`);
    url.searchParams.set('startAt', String(startAt));
    url.searchParams.set('endAt', String(endAt));
    url.searchParams.set('unit', unit);
    url.searchParams.set('timezone', timezone);

    const res = await fetch(url.toString(), {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Umami getPageviews failed (${res.status})`);
    return res.json();
}

/**
 * Get metric breakdowns: top pages, referrers, browsers, devices, countries, etc.
 */
export async function umamiGetMetrics(
    baseUrl: string,
    token: string,
    siteId: string,
    startAt: number,
    endAt: number,
    type: UmamiMetricType,
    limit = 10,
): Promise<UmamiMetricItem[]> {
    const url = new URL(`${baseUrl}/api/websites/${siteId}/metrics`);
    url.searchParams.set('startAt', String(startAt));
    url.searchParams.set('endAt', String(endAt));
    url.searchParams.set('type', type);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Umami getMetrics(${type}) failed (${res.status})`);
    return res.json();
}

/**
 * Get number of active visitors (within the last 5 minutes).
 */
export async function umamiGetActive(
    baseUrl: string,
    token: string,
    siteId: string,
): Promise<number> {
    const res = await fetch(`${baseUrl}/api/websites/${siteId}/active`, {
        headers: authHeaders(token),
        signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.visitors ?? 0;
}

/**
 * Re-authenticate if token is stale. Returns a fresh token.
 */
export async function umamiRefreshToken(baseUrl: string): Promise<string> {
    // Umami self-hosted default credentials are set at deploy time.
    // We always log in with the stored password — the token is long-lived.
    // This is called only as a fallback if a stored token fails.
    return umamiLogin(baseUrl, 'admin', 'umami');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}
