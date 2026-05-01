import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const fron = await prisma.project.findFirst({
        where: { name: 'fron' }
    });
    console.log("Fron project deploy strategy:", fron?.deployStrategy);
}

main().catch(console.error).finally(() => prisma.$disconnect());
