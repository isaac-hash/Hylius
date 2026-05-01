import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const dbs = await prisma.database.findMany({
    where: { name: 'fadt' }
  });
  console.log('fadt databases:', JSON.stringify(dbs, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
