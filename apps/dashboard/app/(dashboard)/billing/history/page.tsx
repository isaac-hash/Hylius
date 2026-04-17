"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";

export default function SubscriptionHistory() {
    // Mock data for the demonstration
    const transactions = [
        { id: "tx_1", date: "2026-03-01", amount: "$29.00", status: "Paid", plan: "Pro" },
        { id: "tx_2", date: "2026-02-01", amount: "$29.00", status: "Paid", plan: "Pro" },
        { id: "tx_3", date: "2026-01-01", amount: "$29.00", status: "Paid", plan: "Pro" },
    ];

    return (
        <AuthGuard>
            <div className="py-6 min-h-screen text-white">
                <header className="mb-10 animate-reveal">
                    <div className="flex items-center gap-4 mb-2">
                        <Link href="/billing" className="text-gray-400 hover:text-white transition-colors">
                            ← Back to Billing
                        </Link>
                    </div>
                    <h1 className="font-display text-4xl font-bold mb-2 tracking-tight">Subscription History</h1>
                    <p className="text-gray-400 max-w-2xl">View your past transactions and subscription changes.</p>
                </header>

                <div className="glass rounded-[32px] overflow-hidden border border-white/10 animate-reveal" style={{ animationDelay: '100ms' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5">
                                    <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-gray-400">Date</th>
                                    <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-gray-400">Amount</th>
                                    <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-gray-400">Plan</th>
                                    <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                                    <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-gray-400 text-right">Invoice</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-8 py-5 text-sm font-medium">{tx.date}</td>
                                        <td className="px-8 py-5 text-sm font-bold text-white">{tx.amount}</td>
                                        <td className="px-8 py-5 text-sm text-gray-400">{tx.plan}</td>
                                        <td className="px-8 py-5">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-bold text-green-400">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="text-xs font-bold text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-all">
                                                Download PDF
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
