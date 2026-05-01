import { PrismaClient } from '@prisma/client';
import { buildConnectionStringFromRecord } from './services/database.service';

const prisma = new PrismaClient();

async function fixEnv() {
  const fase = await prisma.database.findFirst({ where: { name: 'fase' } });
  if (!fase) throw new Error('fase db not found');

  const connectionString = buildConnectionStringFromRecord(fase, true); // internal url
  console.log('Fase connection string:', connectionString);

  // 1. Update API env
  await prisma.project.updateMany({
    where: { name: 'api' },
    data: {
      envVars: JSON.stringify({ DATABASE_URL: connectionString })
    }
  });

  // 2. Update Fron env
  // The public IP of the server is 77.68.50.228, backend port is 3015.
  await prisma.project.updateMany({
    where: { name: 'fron' },
    data: {
      envVars: JSON.stringify({ VITE_API_URL: 'http://77.68.50.228:3015' })
    }
  });

  console.log('Environment variables updated successfully.');
}

fixEnv().catch(console.error).finally(() => prisma.$disconnect());
