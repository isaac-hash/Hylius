const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const orgs = await prisma.organization.findMany();
    console.log('Orgs:', orgs.map(o => ({ id: o.id, slug: o.slug, plan: o.plan })));

    const subs = await prisma.subscription.findMany();
    console.log('Subs:', subs.length);

    const payments = await prisma.payment.findMany();
    console.log('Payments:', payments.length);

    await prisma.$disconnect();
}

check().catch(e => {
    console.error(e);
    process.exit(1);
});
