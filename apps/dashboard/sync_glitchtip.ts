import { PrismaClient } from '@prisma/client';
import { GlitchtipApiService } from './services/glitchtip-api.service';

const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany();
    for (const p of projects) {
        console.log(`Ensuring project: ${p.name} (${p.id})`);
        try {
            const dsn = await GlitchtipApiService.ensureProject(p.id);
            console.log(`  DSN: ${dsn}`);
        } catch (e: any) {
            console.error(`  Error: ${e.message}`);
        }
    }
}
main().finally(() => prisma.$disconnect());
