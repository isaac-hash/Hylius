import { prisma } from './prisma';
import { sendEmail, getAlertEmailTemplate } from './mail.service';

export interface CreateAlertOptions {
    organizationId: string;
    type: 'SERVER_OFFLINE' | 'DEPLOYMENT_FAILED' | 'HIGH_CPU' | 'HIGH_DISK';
    message: string;
    serverId?: string;
    projectId?: string;
}

export class AlertService {
    // 1 hour cooldown per type per server/project to prevent spam
    private static readonly COOLDOWN_MS = 60 * 60 * 1000; 

    static async triggerAlert(options: CreateAlertOptions) {
        // 1. Check for recent similar alerts (Throttling)
        const recentAlert = await prisma.alert.findFirst({
            where: {
                organizationId: options.organizationId,
                type: options.type,
                serverId: options.serverId || null,
                projectId: options.projectId || null,
                createdAt: {
                    gte: new Date(Date.now() - this.COOLDOWN_MS)
                }
            }
        });

        if (recentAlert) {
            console.log(`[AlertService] Throttled duplicate alert: ${options.type} for ${options.serverId || options.projectId || options.organizationId}`);
            return; // Skip creating a new alert
        }

        // 2. Create the Alert in DB
        const alert = await prisma.alert.create({
            data: {
                organizationId: options.organizationId,
                type: options.type,
                message: options.message,
                serverId: options.serverId,
                projectId: options.projectId,
            }
        });

        // 3. Send Email Notification
        try {
            // Find organization owners/admins to notify
            const users = await prisma.user.findMany({
                where: {
                    organizationId: options.organizationId,
                    role: { in: ['OWNER', 'ADMIN'] }
                }
            });

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const dashboardUrl = `${baseUrl}/dashboard`;
            
            const emailHtml = getAlertEmailTemplate(options.type, options.message, dashboardUrl);

            for (const user of users) {
                // If they are verified, send them an email
                // (or if they're the only user, maybe send anyway? Let's send to verified users)
                if (user.isEmailVerified) {
                    await sendEmail({
                        to: user.email,
                        subject: `[Hylius Alert] ${options.type.replace(/_/g, ' ')}`,
                        htmlContent: emailHtml
                    });
                }
            }

        } catch (error) {
            console.error('[AlertService] Failed to send alert email:', error);
        }

        return alert;
    }
}
