import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    await prisma.user.update({
        where: { email: 'admin@test.com' },
        data: { role: 'PLATFORM_ADMIN' }
    });
    console.log('User upgraded to PLATFORM_ADMIN');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
