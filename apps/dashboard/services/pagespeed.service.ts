/* eslint-disable no-console */
/**
 * PageSpeed Insights Service
 *
 * Fetches Core Web Vitals (LCP, FID, CLS) and SEO scores from the
 * Google PageSpeed Insights API v5.
 *
 * The default strategy is "mobile" with a simulated 4G connection,
 * giving users performance metrics closest to a typical Nigerian
 * mobile experience.
 */

import { prisma } from './prisma';

const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export interface PageSpeedResult {
    lcp: number;   // seconds
    fid: number;   // milliseconds
    cls: number;   // unitless
    seoScore: number; // 0-100
}

/**
 * Run a PageSpeed audit against a URL and persist results.
 */
export async function runPageSpeedAudit(projectId: string, url: string): Promise<PageSpeedResult> {
    const apiKey = process.env.PAGESPEED_API_KEY; // optional but recommended
    const params = new URLSearchParams({
        url,
        strategy: 'mobile',
        category: 'performance',
        ...(apiKey ? { key: apiKey } : {}),
    });
    params.append('category', 'seo');

    const res = await fetch(`${PSI_API}?${params.toString()}`);
    if (!res.ok) {
        let message = `PageSpeed API error (${res.status})`;
        try {
            const errJson = await res.json();
            const details = errJson?.error;
            if (res.status === 429 || details?.code === 429) {
                message = apiKey
                    ? 'Google PageSpeed quota exceeded. Your API key has reached its daily limit — try again tomorrow or request a higher quota at console.cloud.google.com.'
                    : 'Google PageSpeed daily quota exceeded. Add a PAGESPEED_API_KEY to your .env to get a higher limit (1,000 free req/day per key).';
            } else if (res.status === 403 || details?.code === 403) {
                message = 'PageSpeed API key is invalid or the PageSpeed Insights API is not enabled in your Google Cloud project.';
            } else if (details?.message) {
                message = `PageSpeed API: ${details.message}`;
            }
        } catch { /* use default message */ }
        throw new Error(message);
    }

    const json = await res.json();
    const lhr = json.lighthouseResult;

    const lcp = (lhr?.audits?.['largest-contentful-paint']?.numericValue ?? 0) / 1000; // ms → s
    const fid = lhr?.audits?.['max-potential-fid']?.numericValue ?? 0; // already ms
    const cls = lhr?.audits?.['cumulative-layout-shift']?.numericValue ?? 0;
    const seoScore = Math.round((lhr?.categories?.seo?.score ?? 0) * 100);

    const result: PageSpeedResult = { lcp, fid, cls, seoScore };

    // Persist to PerformanceAudit
    // @ts-ignore — model exists in schema
    await prisma.performanceAudit.create({
        data: {
            projectId,
            lcp: result.lcp,
            fid: result.fid,
            cls: result.cls,
            seoScore: result.seoScore,
        },
    });

    console.log(`[PageSpeed] Audit saved for project ${projectId}: LCP=${lcp}s FID=${fid}ms CLS=${cls} SEO=${seoScore}`);

    return result;
}

/**
 * Fetch historical audits for a project (for trend charts).
 */
export async function getAuditHistory(projectId: string, limit = 30) {
    // @ts-ignore
    return prisma.performanceAudit.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

export const PageSpeedService = {
    runPageSpeedAudit,
    getAuditHistory,
};
