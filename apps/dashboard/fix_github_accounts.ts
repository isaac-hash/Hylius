import { PrismaClient } from '@prisma/client';
import { getAppOctokit } from './services/github.service';

const prisma = new PrismaClient();

async function main() {
    const installations = await prisma.gitHubInstallation.findMany({
        where: { accountLogin: 'unknown' }
    });

    if (installations.length === 0) {
        console.log('No unknown installations found.');
        return;
    }

    const octokit = getAppOctokit();

    for (const inst of installations) {
        try {
            const { data } = await octokit.apps.getInstallation({ installation_id: inst.installationId });
            const login = (data.account as any)?.login || 'unknown';
            const type = (data.account as any)?.type || 'User';

            if (login !== 'unknown') {
                await prisma.gitHubInstallation.update({
                    where: { id: inst.id },
                    data: { accountLogin: login, accountType: type }
                });
                console.log(`Updated installation ${inst.installationId} to use login ${login} (${type})`);
            } else {
                console.log(`Still unknown for installation ${inst.installationId}`);
            }
        } catch (err: any) {
            console.error(`Failed to update installation ${inst.installationId}:`, err.message);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
