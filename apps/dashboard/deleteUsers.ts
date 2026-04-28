import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emails = ['zikkyychukwudulue@gmail.com', 'zeec2323@gmail.com'];
  
  for (const email of emails) {
    try {
      // First, get the user so we can delete their organization if they are the owner
      const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true }
      });

      if (!user) {
        console.log(`User not found: ${email}`);
        continue;
      }

      // We should probably delete the user
      await prisma.user.delete({ where: { email } });
      console.log(`Deleted user: ${email}`);

      // If they had an organization and they were the only user, we might want to delete it too
      if (user.organizationId) {
        const remainingUsers = await prisma.user.count({
            where: { organizationId: user.organizationId }
        });
        
        if (remainingUsers === 0) {
            await prisma.organization.delete({
                where: { id: user.organizationId }
            });
            console.log(`Deleted orphaned organization: ${user.organization?.name}`);
        }
      }

    } catch (e: any) {
      console.log(`Failed to delete ${email}:`, e.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
