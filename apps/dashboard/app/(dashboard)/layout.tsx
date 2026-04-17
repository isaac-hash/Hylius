"use client";

import { AuthGuard } from "@/components/AuthGuard";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <DashboardLayout>{children}</DashboardLayout>
        </AuthGuard>
    );
}
