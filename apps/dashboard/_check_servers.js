const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const servers = await p.server.findMany({
    select: { id: true, name: true, ip: true, hasTrafficAnalytics: true, trafficAnalyticsUrl: true }
  });
  console.table(servers);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
