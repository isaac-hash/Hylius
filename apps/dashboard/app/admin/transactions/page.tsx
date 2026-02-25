"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/providers/auth.provider';

interface Transaction {
    id: string;
    organizationId: string;
    provider: string;
    externalTransactionId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    organization: {
        name: string;
        slug: string;
    };
}

export default function TransactionsPage() {
    const { token } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!token) return;

            try {
                const res = await fetch('/api/admin/transactions', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to fetch transactions');
                }
                const data = await res.json();
                setTransactions(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [token]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'text-green-400 bg-green-400/10 border-green-500/20';
            case 'FAILED': return 'text-red-400 bg-red-400/10 border-red-500/20';
            case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-500/20';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                    <p className="text-gray-400 mt-2">Monitor all payments processed across the platform.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-800 bg-gray-900/50">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Organization</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">External ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-medium">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-900/40 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            {format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-white">{tx.organization.name}</div>
                                            <div className="text-xs text-gray-500">{tx.organization.slug}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-bold px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300">
                                                {tx.provider}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">
                                            {tx.amount.toLocaleString()} <span className="text-xs font-normal text-gray-500">{tx.currency}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(tx.status)}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                            {tx.externalTransactionId}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
