"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";
import { BillingHistory } from "@/components/BillingHistory";

export default function AdminBillingPage() {
    const { user } = useAuth();

    return (
        <AuthGuard>
            <div className="min-h-screen bg-black text-white">
                <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">H</div>
                            <span className="font-bold text-xl tracking-tight">Hylius Admin</span>
                        </Link>
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                            <Link href="/admin" className="hover:text-white transition-colors">Admin panel</Link>
                            <span className="text-gray-300">{user?.email}</span>
                        </div>
                    </div>
                </nav>

                <main className="max-w-6xl mx-auto px-6 py-12">
                    <header className="mb-12 flex items-end justify-between">
                        <div>
                            <div className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2">Platform Management</div>
                            <h1 className="text-4xl font-bold mb-2">Global Billing</h1>
                            <p className="text-gray-400">Monitor subscriptions and payments across all organizations.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-center">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Total Revenue</div>
                                <div className="text-lg font-bold text-white">Live</div>
                            </div>
                        </div>
                    </header>

                    <div className="space-y-12">
                        <section>
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold">Recent Transactions</h2>
                                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded font-bold uppercase tracking-widest border border-blue-500/20">All Organizations</span>
                            </div>

                            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-8 backdrop-blur-sm">
                                <BillingHistory isAdmin={true} />
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
