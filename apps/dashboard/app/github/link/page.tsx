'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/auth.provider';

function GitHubLinkClient() {
    const { token } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Linking GitHub App...');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;

        const installId = searchParams.get('github_install');
        const accountLogin = searchParams.get('account_login');
        const accountType = searchParams.get('account_type');

        if (!installId) {
            router.replace('/');
            return;
        }

        const linkApp = async () => {
            try {
                const res = await fetch('/api/github/installations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ installationId: installId, accountLogin, accountType }),
                });

                if (res.ok) {
                    setStatus('Successfully linked! Redirecting...');
                    setTimeout(() => {
                        router.replace('/');
                    }, 1500);
                } else {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to link');
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'An error occurred during linking.');
            }
        };

        linkApp();
    }, [token, searchParams, router]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-xl max-w-md w-full text-center">

                {error ? (
                    <>
                        <div className="w-12 h-12 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Linking Failed</h2>
                        <p className="text-gray-400 text-sm mb-6">{error}</p>
                        <button
                            onClick={() => router.replace('/')}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold text-white mb-2">{status}</h2>
                        <p className="text-gray-500 text-sm">Please wait while we connect your GitHub account...</p>
                    </>
                )}

            </div>
        </div>
    );
}

export default function GitHubLinkPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center p-4"><div className="w-12 h-12 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin mx-auto"></div></div>}>
            <GitHubLinkClient />
        </Suspense>
    );
}
