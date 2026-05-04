const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.project.findFirst({
    where: { name: 'Hylius' }
  });
  const d = await prisma.deployment.findFirst({
    where: { projectId: p.id },
    orderBy: { startedAt: 'desc' }
  });
  if (d.logContent) {
    fs.writeFileSync('c:\\Users\\HP\\documents\\Anvil\\apps\\dashboard\\deploy.log', d.logContent);
    console.log('Log written to deploy.log');
  } else {
    console.log('No log content.');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
