export interface SendEmailOptions {
    to: string;
    toName?: string;
    subject: string;
    htmlContent: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@hylius.dev';
    const senderName = process.env.BREVO_SENDER_NAME || 'Hylius';

    if (!apiKey) {
        console.warn('BREVO_API_KEY is not set. Skipping email send.');
        return false;
    }

    try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: [{ email: options.to, name: options.toName || options.to }],
                subject: options.subject,
                htmlContent: options.htmlContent
            })
        });

        if (!res.ok) {
            const error = await res.text();
            console.error('Failed to send email via Brevo:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error sending email via Brevo:', error);
        return false;
    }
}

export function getOtpEmailTemplate(code: string): string {
    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Verify your Hylius account</h2>
        <p>Thank you for signing up for Hylius! Please use the following One-Time Password (OTP) to verify your email address:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
            ${code}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
    `;
}

export function getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Reset your Hylius password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #2563eb;"><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    `;
}

export function getAlertEmailTemplate(alertType: string, message: string, dashboardUrl: string): string {
    const isCritical = alertType === 'SERVER_OFFLINE' || alertType === 'DEPLOYMENT_FAILED';
    const color = isCritical ? '#dc2626' : '#ea580c'; // Red for critical, orange for warnings
    const title = alertType.replace(/_/g, ' ');

    return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: ${color}; text-transform: capitalize;">Alert: ${title}</h2>
        <p>Your Hylius monitoring system has detected an issue that requires your attention:</p>
        <div style="background-color: #f9fafb; border-left: 4px solid ${color}; padding: 15px; margin: 20px 0; font-size: 16px;">
            ${message}
        </div>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Dashboard</a>
        </div>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This is an automated alert from your Hylius platform.</p>
    </div>
    `;
}
