import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.project.findFirst({ orderBy: { createdAt: 'desc' } });
    if (p) console.log(p.id);
}
main().catch(console.error).finally(() => prisma.$disconnect());
