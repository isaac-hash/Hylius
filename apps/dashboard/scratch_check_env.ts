import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany({
        select: {
            id: true,
            name: true,
            envVars: true,
            deployments: {
                orderBy: { startedAt: 'desc' },
                take: 1,
                select: { deployUrl: true }
            }
        }
    });

    console.log("Projects:");
    for (const project of projects) {
        console.log(`\nProject: ${project.name} (${project.id})`);
        console.log(`Latest URL: ${project.deployments[0]?.deployUrl || 'None'}`);
        try {
            const envs = JSON.parse(project.envVars || '{}');
            console.log("Env Vars:", envs);
        } catch (e) {
            console.log("Env Vars (raw):", project.envVars);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
