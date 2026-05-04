const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRaw`
    SELECT p.id, p.name, p."trafficAnalyticsSiteId", 
           s."hasTrafficAnalytics", s."trafficAnalyticsUrl",
           (s."trafficAnalyticsToken" IS NOT NULL) as "hasToken"
    FROM "Project" p 
    JOIN "Server" s ON p."serverId" = s.id
  `;
  console.table(rows);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
