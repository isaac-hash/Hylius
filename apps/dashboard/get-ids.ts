import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const projects = await prisma.project.findMany({ where: { name: { in: ['api', 'fron'] } } });
  console.log(JSON.stringify(projects, null, 2));
}
main().finally(() => prisma.$disconnect());
