"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth.provider";

export function AuthGuard({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
    const { token, user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!token) {
                router.push("/login");
            } else if (requireAdmin && user?.role !== 'PLATFORM_ADMIN') {
                router.push("/"); // Redirect non-admins to dashboard
            }
        }
    }, [token, user, isLoading, router, requireAdmin]);


    // Show loading state while checking auth against local storage and API
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-vh-100 min-h-screen bg-black text-white">
                <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 animate-spin border-gray-800"></div>
            </div>
        );
    }

    // If not loading and no token, return nothing while redirect kicks in
    if (!token) {
        return null;
    }

    return <>{children}</>;
}
