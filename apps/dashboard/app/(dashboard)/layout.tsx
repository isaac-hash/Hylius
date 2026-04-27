"use client";

import { AuthGuard } from "@/components/AuthGuard";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";

export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user } = useAuth();

    return (
        <AuthGuard>
            {user && user.isEmailVerified === false && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center justify-center text-amber-500 text-sm z-50 relative">
                    <span>
                        Please verify your email address to unlock all features. 
                        <Link href="/verify-email" className="font-bold underline ml-2 hover:text-amber-400">
                            Verify Now
                        </Link>
                    </span>
                </div>
            )}
            <DashboardLayout>{children}</DashboardLayout>
        </AuthGuard>
    );
}
