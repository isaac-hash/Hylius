"use client";

import { useState, useEffect, use } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        amount: 0,
        currency: 'NGN',
        interval: 'MONTHLY'
    });
    const router = useRouter();

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const token = localStorage.getItem('hylius_token');
                const res = await fetch(`/api/admin/plans/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to load plan');
                const data = await res.json();
                setFormData({
                    name: data.name || '',
                    description: data.description || '',
                    amount: data.amount || 0,
                    currency: data.currency || 'NGN',
                    interval: data.interval || 'MONTHLY'
                });
            } catch (err: any) {
                alert(err.message);
            } finally {
                setFetching(false);
            }
        };
        fetchPlan();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('hylius_token');
            const res = await fetch(`/api/admin/plans/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Failed to update plan');

            router.push('/admin/plans');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <AuthGuard requireAdmin>
                <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
                    <div className="text-gray-500">Loading plan Details...</div>
                </div>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard requireAdmin>
            <div className="min-h-screen bg-black text-white p-8">
                <div className="max-w-xl mx-auto">
                    <Link href="/admin/plans" className="text-gray-500 hover:text-white text-sm flex items-center gap-2 mb-8 transition-colors">
                        ← Back to Plans
                    </Link>

                    <h1 className="text-3xl font-bold mb-2">Edit Plan</h1>
                    <p className="text-gray-400 mb-12">Modify the existing billing tier for your users.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Plan Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Pro Monthly"
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="25000"
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Currency</label>
                                <select
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    value={formData.currency}
                                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="NGN">NGN (Naira)</option>
                                    <option value="USD">USD (Dollar)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Billing Interval</label>
                            <select
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                value={formData.interval}
                                onChange={e => setFormData({ ...formData, interval: e.target.value })}
                            >
                                <option value="MONTHLY">Monthly</option>
                                <option value="YEARLY">Yearly</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Description (Optional)</label>
                            <textarea
                                placeholder="What's included in this plan?"
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors h-32"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                        >
                            {loading ? "Saving changes..." : "Save Changes"}
                        </button>
                    </form>
                </div>
            </div>
        </AuthGuard>
    );
}
