const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting Uptime Monitor Backfill...");
    
    const projects = await prisma.project.findMany({
        where: {
            server: {
                hasUptimeMonitoring: true
            }
        },
        include: {
            server: true,
            domains: true,
            uptimeMonitor: true
        }
    });

    let count = 0;

    for (const project of projects) {
        if (!project.uptimeMonitor) {
            console.log(`Creating monitor for project: ${project.name}`);
            
            let endpoint = '';
            if (project.domains && project.domains.length > 0) {
                endpoint = `https://${project.domains[0].hostname}`;
            } else {
                endpoint = `http://${project.server.ip}`; // basic fallback
            }

            await prisma.uptimeMonitor.create({
                data: {
                    name: `${project.name} Production`,
                    endpoint: endpoint,
                    type: 'HTTP',
                    interval: 30,
                    autoHeal: true,
                    serverId: project.serverId,
                    projectId: project.id,
                }
            });
            count++;
        }
    }

    console.log(`Backfill complete. Created ${count} monitors.`);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
