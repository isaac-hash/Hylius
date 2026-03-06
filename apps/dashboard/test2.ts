import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.project.findFirst({ where: { name: 'my-blog' } }).then(x => console.log('githubInstallationId =', x?.githubInstallationId)).finally(() => p.$disconnect());
