import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const all = await p.server.findMany({
  select: { id: true, name: true, ip: true, agentToken: true, connectionMode: true, status: true, lastHeartbeatAt: true }
});

console.log(`\n=== Current DB state: ${all.length} server(s) ===\n`);
all.forEach(s => {
  console.log(`  ${s.name} (${s.id})`);
  console.log(`    IP: ${s.ip}`);
  console.log(`    Token: ${s.agentToken}`);
  console.log(`    Mode: ${s.connectionMode} | Status: ${s.status}`);
  console.log(`    Last HB: ${s.lastHeartbeatAt}`);
  console.log();
});

await p.$disconnect();
