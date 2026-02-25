"use client";

import { useState, useEffect, use } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Plan {
    id: string;
    name: string;
    amount: number;
    currency: string;
    interval: string;
}

export default function PaymentSelectionPage({ params }: { params: Promise<{ planId: string }> }) {
    const { planId } = use(params);
    const { user } = useAuth();
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await fetch("/api/plans");
                const plans: Plan[] = await res.json();
                const found = plans.find(p => p.id === planId);
                setPlan(found || null);
            } catch (err) {
                console.error("Failed to load plan");
            } finally {
                setLoading(false);
            }
        };
        fetchPlan();
    }, [planId]);

    const handleCheckout = async (providerId: string) => {
        setProcessing(true);
        try {
            const token = localStorage.getItem("hylius_token");
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    providerId,
                    planId: planId,
                }),
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || "Failed to create checkout session");
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
    if (!plan) return <div className="min-h-screen bg-black text-white flex items-center justify-center text-center">Plan not found.<br /><Link href="/billing" className="text-blue-500 mt-4 inline-block">Back to Billing</Link></div>;

    return (
        <AuthGuard>
            <div className="min-h-screen bg-black text-white p-8">
                <div className="max-w-2xl mx-auto">
                    <Link href="/billing" className="text-gray-500 hover:text-white text-sm mb-12 inline-block transition-colors">
                        ← Change Plan
                    </Link>

                    <div className="mb-12">
                        <h1 className="text-3xl font-bold mb-2">Complete Checkout</h1>
                        <p className="text-gray-400">Choose your preferred payment method for {plan.name}.</p>
                    </div>

                    <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-8 mb-8">
                        <div className="flex justify-between items-center pb-8 border-b border-gray-800 mb-8">
                            <div>
                                <h3 className="text-lg font-bold">{plan.name} Subscription</h3>
                                <p className="text-gray-500 text-sm">Billed {plan.interval.toLowerCase()}</p>
                            </div>
                            <div className="text-2xl font-bold">
                                {plan.currency === 'USD' ? '$' : '₦'}{plan.amount.toLocaleString()}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-4">Select Provider</label>

                            {/* Paystack Option */}
                            <button
                                onClick={() => handleCheckout('PAYSTACK')}
                                disabled={processing}
                                className="w-full flex items-center justify-between p-6 rounded-2xl border border-gray-800 hover:border-blue-500 bg-gray-900/50 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <div className="w-5 h-5 bg-emerald-500 rounded-full"></div>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold">Paystack</div>
                                        <div className="text-xs text-gray-500">Pay with Card, Bank Transfer, or USSD</div>
                                    </div>
                                </div>
                                <div className="w-6 h-6 rounded-full border-2 border-gray-800 group-hover:border-blue-500 transition-colors"></div>
                            </button>

                            {/* Flutterwave Option */}
                            <button
                                onClick={() => handleCheckout('FLUTTERWAVE')}
                                disabled={processing}
                                className="w-full flex items-center justify-between p-6 rounded-2xl border border-gray-800 hover:border-blue-500 bg-gray-900/50 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                        <div className="w-5 h-5 bg-blue-500 rounded-full"></div>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold">Flutterwave</div>
                                        <div className="text-xs text-gray-500">Fast and secure Africa-wide payments</div>
                                    </div>
                                </div>
                                <div className="w-6 h-6 rounded-full border-2 border-gray-800 group-hover:border-blue-500 transition-colors"></div>
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-xs text-gray-600">
                        Secure SSL Encrypted Payment. Your data is protected.
                    </p>
                </div>
            </div>
        </AuthGuard>
    );
}
