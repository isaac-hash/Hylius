import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    // Reset traffic analytics flag so user can re-install and trigger real deployment
    const result = await p.server.updateMany({
        data: {
            hasTrafficAnalytics: false,
            trafficAnalyticsUrl: null,
        } as any,
    });
    console.log(`Reset ${result.count} server(s) — hasTrafficAnalytics=false, trafficAnalyticsUrl=null`);
    await p.$disconnect();
}

main();
