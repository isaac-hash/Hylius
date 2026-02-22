"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth.provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { token, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !token) {
            router.push("/login"); // Redirect unauthenticated users
        }
    }, [token, isLoading, router]);


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
