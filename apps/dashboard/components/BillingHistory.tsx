"use client";

import { useEffect, useState } from "react";

interface Payment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    provider: string;
    externalTransactionId: string;
    organization?: {
        name: string;
        slug: string;
    };
}

interface BillingHistoryProps {
    isAdmin?: boolean;
}

export function BillingHistory({ isAdmin = false }: BillingHistoryProps) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem("hylius_token");
                const url = isAdmin ? "/api/admin/billing" : "/api/billing/history";
                const res = await fetch(url, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setPayments(data.payments || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [isAdmin]);

    if (loading) return <div className="text-gray-400 text-sm py-4 italic">Loading history...</div>;
    if (error) return <div className="text-red-400 text-sm py-4">Error: {error}</div>;
    if (payments.length === 0) return <div className="text-gray-500 text-sm py-4 italic">No transactions found.</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                        <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-[10px]">Date</th>
                        {isAdmin && <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-[10px]">Organization</th>}
                        <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-[10px]">Amount</th>
                        <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-[10px]">Status</th>
                        <th className="pb-3 pr-4 font-medium uppercase tracking-wider text-[10px]">Reference</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {payments.map((payment) => (
                        <tr key={payment.id} className="group">
                            <td className="py-4 pr-4 whitespace-nowrap text-gray-300">
                                {new Date(payment.createdAt).toLocaleDateString()}
                            </td>
                            {isAdmin && (
                                <td className="py-4 pr-4 text-gray-300">
                                    {payment.organization?.name}
                                    <span className="text-gray-500 text-[10px] ml-1">({payment.organization?.slug})</span>
                                </td>
                            )}
                            <td className="py-4 pr-4 font-medium text-white">
                                {payment.currency} {(payment.amount).toFixed(2)}
                            </td>
                            <td className="py-4 pr-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${payment.status === 'SUCCESS' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                    }`}>
                                    {payment.status}
                                </span>
                            </td>
                            <td className="py-4 pr-0 font-mono text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">
                                {payment.externalTransactionId}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
