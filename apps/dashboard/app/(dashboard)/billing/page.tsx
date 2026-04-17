"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";
import { BillingHistory } from "@/components/BillingHistory";

interface Plan {
    id: string;
    name: string;
    description: string | null;
    amount: number;
    currency: string;
    interval: string;
}

export default function BillingPage() {
    const { user, organization } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch("/api/plans");
                const data = await res.json();
                setPlans(data);
            } catch (err) {
                console.error("Failed to load plans");
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    return (
        <AuthGuard>
            <div className="min-h-screen bg-black text-white">
                <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">H</div>
                            <span className="font-bold text-xl tracking-tight">Hylius</span>
                        </Link>
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                            <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
                            <span className="text-gray-300">{user?.email}</span>
                        </div>
                    </div>
                </nav>

                <main className="max-w-4xl mx-auto px-6 py-12">
                    <header className="mb-12">
                        <h1 className="text-3xl font-bold mb-2">Billing</h1>
                        <p className="text-gray-400">Manage your subscription and plans.</p>
                    </header>

                    <div className="grid md:grid-cols-2 gap-8">
                        {loading ? (
                            <div className="col-span-2 text-center py-12 text-gray-500">Loading plans...</div>
                        ) : (
                            plans.map((plan) => (
                                <div key={plan.id} className={`p-8 rounded-2xl border transition-all ${plan.name.toLowerCase().includes('pro')
                                        ? 'bg-blue-600/10 border-blue-500/50'
                                        : 'bg-gray-900/50 border-gray-800'
                                    } flex flex-col relative overflow-hidden group`}>
                                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                    <p className="text-gray-400 mb-6 text-sm">
                                        {plan.description || "Get started with our basic features."}
                                    </p>
                                    <div className="text-4xl font-bold mb-8">
                                        {plan.currency === 'USD' ? '$' : '₦'}{plan.amount.toLocaleString()}
                                        <span className="text-lg text-gray-500 font-normal">/{plan.interval.toLowerCase().replace('ly', '')}</span>
                                    </div>

                                    <ul className="space-y-4 mb-8 flex-grow text-sm text-gray-300">
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Managed Cloud Servers
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            SSH Key Management
                                        </li>
                                    </ul>

                                    <Link
                                        href={`/billing/payment/${plan.id}`}
                                        className={`w-full py-3 rounded-xl text-center font-medium transition-all ${plan.name.toLowerCase().includes('pro')
                                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                                : 'bg-white text-black hover:bg-gray-100'
                                            }`}
                                    >
                                        Select Plan
                                    </Link>
                                </div>
                            ))
                        )}

                        {plans.length === 0 && !loading && (
                            <div className="col-span-2 text-center py-12 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800">
                                <p className="text-gray-500">No active plans available. Contact support.</p>
                            </div>
                        )}
                    </div>

                    {/* Billing History Section */}
                    <div className="mt-16 pt-12 border-t border-gray-800">
                        <header className="mb-8">
                            <h2 className="text-2xl font-bold mb-2">Billing History</h2>
                            <p className="text-gray-400 text-sm">View your past transactions and subscription updates.</p>
                        </header>

                        <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6">
                            <BillingHistory />
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
