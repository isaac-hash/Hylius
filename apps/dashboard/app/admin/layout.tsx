"use client";

import { useAuth } from "@/providers/auth.provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'PLATFORM_ADMIN') {
                router.push('/');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading || !user || user.role !== 'PLATFORM_ADMIN') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <DashboardLayout sidebar={<AdminSidebar />}>
            {children}
        </DashboardLayout>
    );
}
