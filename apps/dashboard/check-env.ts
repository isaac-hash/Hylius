import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const projects = await prisma.project.findMany({
    where: { name: 'fron' }
  });
  console.log('Fron projects:', JSON.stringify(projects, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
