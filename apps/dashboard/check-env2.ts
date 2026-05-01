import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const dbs = await prisma.database.findMany();
  console.log('Databases:', JSON.stringify(dbs, null, 2));

  const apiProject = await prisma.project.findFirst({ where: { name: 'api' } });
  console.log('API Project EnvVars:', apiProject?.envVars);
}

check().catch(console.error).finally(() => prisma.$disconnect());
