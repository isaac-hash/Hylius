const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: 'rea-lara' },
        include: { server: true }
    });
    
    const dbs = await prisma.database.findMany({
        where: { projectId: project.id }
    });
    
    require('fs').writeFileSync('dbs.json', JSON.stringify(dbs, null, 2));
}

main().finally(() => prisma.$disconnect());
