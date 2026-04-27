import { PrismaClient } from '@prisma/client';
import { sendEmail, getPasswordResetEmailTemplate } from './services/mail.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    // Replace this with the exact email you want to test
    const email = 'zeec2323@gmail.com'; 
    
    // Check if user exists
    const users = await prisma.user.findMany();
    console.log('All user emails in DB:', users.map(u => u.email));

    const user = await prisma.user.findFirst({
        where: {
            email: {
                equals: email,
                mode: 'insensitive'
            }
        }
    });

    if (!user) {
        console.log(`\nUser ${email} does not exist in DB!`);
        return;
    }

    console.log(`\nFound user: ${user.email}. Generating token...`);
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    console.log(`Generated resetUrl: ${resetUrl}`);
    
    console.log('\nAttempting to send email via Brevo...');
    const result = await sendEmail({
        to: user.email,
        subject: 'Test Reset your Hylius password',
        htmlContent: getPasswordResetEmailTemplate(resetUrl)
    });
    
    console.log(`Email send result: ${result ? 'SUCCESS' : 'FAILED'}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
