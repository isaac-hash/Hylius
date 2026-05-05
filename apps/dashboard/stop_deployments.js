const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.deployment.updateMany({
    where: {
      status: {
        in: ['PENDING', 'BUILDING']
      }
    },
    data: {
      status: 'FAILED'
    }
  });
  console.log(`Updated ${result.count} stalled deployments to FAILED.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
