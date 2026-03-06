import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.project.findMany({ where: { name: 'insight-blog' }, orderBy: { createdAt: 'desc' } }).then(console.log).finally(() => p.$disconnect());
