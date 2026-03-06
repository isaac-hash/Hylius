import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.server.findUnique({ where: { id: 'cmmdqvft5002nkmfwy5zbhvur' } }).then((s: any) => {
    console.log(s ? `Server: ${s.ip}:${s.port}` : 'Server not found');
    prisma.$disconnect();
});
