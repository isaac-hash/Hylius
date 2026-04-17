"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
    children,
    sidebar,
}: {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            {/* Mobile Header Toggle */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 glass z-40 flex items-center px-6 justify-between border-b">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
                        <span className="text-white text-lg">H</span>
                    </div>
                    <span className="font-display font-bold text-xl">Hylius</span>
                </div>
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                >
                    ☰
                </button>
            </div>

            {/* Sidebar */}
            {sidebar || (
                <Sidebar 
                    isOpen={isSidebarOpen} 
                    onClose={() => setIsSidebarOpen(false)} 
                />
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-y-auto transition-all duration-300">
                <div className="flex-1 pt-16 md:pt-0">
                    <div className="max-w-[1600px] mx-auto p-4 md:p-8 lg:p-12">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
