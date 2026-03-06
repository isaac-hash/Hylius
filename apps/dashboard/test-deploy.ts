import { executeDeployment } from './services/deploy.service';
import { prisma } from './services/prisma';

async function main() {
    console.log('Fetching first project...');
    const project = await prisma.project.findFirst({
        where: { name: 'insight-blog' }
    });

    if (!project) {
        console.error('Project not found');
        return;
    }

    console.log(`Triggering deploy for ${project.name}...`);
    const result = await executeDeployment({
        projectId: project.id,
        trigger: 'webhook',
        onLog: (chunk) => process.stdout.write(`LOG: ${chunk}`)
    });

    console.log('Result:', result);
}

main().catch(console.error).finally(() => process.exit(0));
