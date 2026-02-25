"use client";

import Link from "next/link";

export default function PaymentCancelPage() {
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center max-w-md mx-auto px-6">
                <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold mb-3">Payment Cancelled</h1>
                <p className="text-gray-400 mb-8">
                    No worries — you haven&apos;t been charged. You can upgrade anytime.
                </p>

                <Link
                    href="/billing"
                    className="inline-block px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                >
                    Back to Billing
                </Link>
            </div>
        </div>
    );
}
