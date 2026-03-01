import { PrismaClient } from '@prisma/client';
import { encrypt } from './services/crypto.service';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No org found");

  const password = "testpassword";
  const { encrypted, iv } = encrypt(password);

  const server = await prisma.server.create({
    data: {
      name: "mock-vps-stark",
      ip: "127.0.0.1",
      port: 2222,
      username: "root",
      privateKeyEncrypted: encrypted,
      keyIv: iv,
      organizationId: org.id
    }
  });

  const project = await prisma.project.create({
    data: {
      name: "stark-terminal",
      repoUrl: "https://github.com/isaac-hash/stark-inspect-terminal",
      branch: "main",
      deployPath: "/var/www/stark-terminal",
      organizationId: org.id,
      serverId: server.id
    }
  });

  console.log("Seeded successfully!");
  console.log("Server ID:", server.id);
  console.log("Project ID:", project.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
