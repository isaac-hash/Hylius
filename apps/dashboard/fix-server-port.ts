import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.server.update({
    where: { id: 'cmmdqvft5002nkmfwy5zbhvur' },
    data: { port: 2225 }
}).then((s: any) => {
    console.log(`Updated Server Port to: ${s.port}`);
    prisma.$disconnect();
});
