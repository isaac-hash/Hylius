import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const projects = await (prisma as any).project.findMany({
        where: { name: { contains: 'lara' } },
        select: { id: true, name: true, envVars: true },
    });

    for (const p of projects) {
        console.log(`\nProject: ${p.name} (${p.id})`);
        if (p.envVars) {
            const env = JSON.parse(p.envVars as string);
            const dbKeys = ['DATABASE_URL', 'DB_URL', 'DB_HOST', 'DB_PORT'];
            for (const k of dbKeys) {
                if (env[k]) console.log(`  ${k} = ${env[k]}`);
            }
        }
    }

    const dbs = await (prisma as any).database.findMany({
        select: { id: true, name: true, port: true, containerName: true, projectId: true, status: true },
    });
    console.log('\nDatabases:');
    for (const db of dbs) {
        console.log(`  ${db.name}: port=${db.port}, container=${db.containerName}, project=${db.projectId}, status=${db.status}`);
    }

    await prisma.$disconnect();
}

main().catch(console.error);
