"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PaymentSuccessPage() {
    const searchParams = useSearchParams();
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // window.location.href = "/billing";
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
                {/* Animated checkmark */}
                <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold mb-3">Payment Successful!</h1>
                <p className="text-gray-400 mb-2">
                    Your subscription has been activated. Welcome to Hylius Pro!
                </p>
                {reference && (
                    <p className="text-gray-500 text-sm mb-8">
                        Reference: <span className="font-mono text-gray-400">{reference}</span>
                    </p>
                )}

                <p className="text-gray-500 text-sm mb-6">
                    Redirecting to billing in {countdown}s...
                </p>

                <Link
                    href="/billing"
                    className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                    Go to Billing Now
                </Link>
            </div>
        </div>
    );
}
