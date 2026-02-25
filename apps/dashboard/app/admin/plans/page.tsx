"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Plan {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
    paystackPlanCode: string | null;
    flutterwavePlanId: string | null;
    isActive: boolean;
}

export default function AdminPlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const router = useRouter();

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('hylius_token');
            const res = await fetch('/api/admin/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPlans(data);
        } catch (err) {
            console.error('Failed to fetch plans');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleSync = async (id: string, provider: 'PAYSTACK' | 'FLUTTERWAVE') => {
        setSyncingId(`${id}-${provider}`);
        try {
            const token = localStorage.getItem('hylius_token');
            const res = await fetch(`/api/admin/plans/${id}/sync?provider=${provider}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            alert(`Synced with ${provider.toLowerCase()} successfully!`);
            fetchPlans();
        } catch (err: any) {
            alert('Sync failed: ' + err.message);
        } finally {
            setSyncingId(null);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const token = localStorage.getItem('hylius_token');
            await fetch(`/api/admin/plans/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            fetchPlans();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    return (
        <AuthGuard requireAdmin>
            <div className="min-h-screen bg-black text-white p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-12">
                        <div>
                            <h1 className="text-3xl font-bold">Billing Plans</h1>
                            <p className="text-gray-400 mt-2">Manage subscription tiers and provider synchronization.</p>
                        </div>
                        <Link
                            href="/admin/plans/new"
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                        >
                            Create New Plan
                        </Link>
                    </div>

                    <div className="bg-gray-900/30 border border-gray-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-800 text-gray-400 bg-gray-900/50">
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Plan Name</th>
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Price</th>
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Interval</th>
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Paystack ID</th>
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Flutterwave ID</th>
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Status</th>
                                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-[10px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading plans...</td></tr>
                                ) : plans.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No plans found. Create your first one.</td></tr>
                                ) : plans.map((plan) => (
                                    <tr key={plan.id} className="hover:bg-gray-800/20 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-200">{plan.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                            {plan.currency} {plan.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-400 capitalize">{plan.interval.toLowerCase()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {plan.paystackPlanCode ? (
                                                <code className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-[11px]">{plan.paystackPlanCode}</code>
                                            ) : (
                                                <span className="text-gray-600 italic text-xs">Not Synced</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {plan.flutterwavePlanId ? (
                                                <code className="text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded text-[11px]">{plan.flutterwavePlanId}</code>
                                            ) : (
                                                <span className="text-gray-600 italic text-xs">Not Synced</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => toggleStatus(plan.id, plan.isActive)}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${plan.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                                    }`}
                                            >
                                                {plan.isActive ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                                            <button
                                                onClick={() => handleSync(plan.id, 'PAYSTACK')}
                                                disabled={!!syncingId && syncingId.includes(plan.id)}
                                                className="text-gray-400 hover:text-blue-400 text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                {syncingId === `${plan.id}-PAYSTACK` ? 'Syncing...' : 'Sync Paystack'}
                                            </button>
                                            <button
                                                onClick={() => handleSync(plan.id, 'FLUTTERWAVE')}
                                                disabled={!!syncingId && syncingId.includes(plan.id)}
                                                className="text-gray-400 hover:text-orange-400 text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                {syncingId === `${plan.id}-FLUTTERWAVE` ? 'Syncing...' : 'Sync Flutterwave'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
