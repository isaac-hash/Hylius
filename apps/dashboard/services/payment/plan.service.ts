import { prisma } from '../prisma';

export interface PlanData {
    name: string;
    description?: string;
    amount: number;
    currency: string;
    interval: string;
}

export class PlanService {
    /**
     * List all plans (active or inactive)
     */
    async listPlans(onlyActive = false) {
        return prisma.plan.findMany({
            where: onlyActive ? { isActive: true } : {},
            orderBy: { amount: 'asc' }
        });
    }

    /**
     * Create a local plan record
     */
    async createPlan(data: PlanData) {
        return prisma.plan.create({
            data: {
                ...data,
                isActive: true
            }
        });
    }

    /**
     * Update a local plan record
     */
    async updatePlan(id: string, data: Partial<PlanData> & { isActive?: boolean }) {
        return prisma.plan.update({
            where: { id },
            data
        });
    }

    /**
     * Push a plan to Paystack and save the plan_code
     */
    async syncWithPaystack(planId: string) {
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new Error('Plan not found');

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY missing');

        const res = await fetch('https://api.paystack.co/plan', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: plan.name,
                interval: plan.interval.toLowerCase() as 'monthly' | 'yearly', // Paystack expects lowercase
                amount: plan.amount * 100, // Naira to kobo
                currency: plan.currency
            })
        });

        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Paystack plan creation failed');

        const planCode = data.data.plan_code;

        // Update local DB
        return prisma.plan.update({
            where: { id: planId },
            data: { paystackPlanCode: planCode }
        });
    }
    /**
     * Push a plan to Flutterwave and save the plan id
     */
    async syncWithFlutterwave(planId: string) {
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new Error('Plan not found');

        const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        if (!secretKey) throw new Error('FLUTTERWAVE_SECRET_KEY missing');

        const res = await fetch('https://api.flutterwave.com/v3/payment-plans', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: plan.name,
                interval: plan.interval.toLowerCase(),
                amount: plan.amount,
                currency: plan.currency
            })
        });

        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Flutterwave plan creation failed');

        const flwPlanId = data.data.id.toString();

        // Update local DB
        return prisma.plan.update({
            where: { id: planId },
            data: { flutterwavePlanId: flwPlanId }
        });
    }
}

export const planService = new PlanService();
