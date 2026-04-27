"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/providers/auth.provider";

interface Alert {
    id: string;
    type: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationPanel() {
    const { user, organization } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);

    // Fetch alerts
    const fetchAlerts = async () => {
        if (!organization?.id) return;
        try {
            const res = await fetch(`/api/alerts?organizationId=${organization.id}`);
            if (res.ok) {
                const data = await res.json();
                setAlerts(data.alerts || []);
                setUnreadCount(data.alerts?.filter((a: Alert) => !a.isRead).length || 0);
            }
        } catch (error) {
            console.error("Failed to fetch alerts", error);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [organization?.id]);

    // Close panel on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (alertId?: string) => {
        if (!organization?.id) return;
        
        // Optimistic update
        setAlerts(prev => prev.map(a => 
            (alertId ? a.id === alertId : true) ? { ...a, isRead: true } : a
        ));
        if (!alertId) setUnreadCount(0);
        else setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            let url = `/api/alerts?organizationId=${organization.id}`;
            if (alertId) url += `&alertId=${alertId}`;
            await fetch(url, { method: "PATCH" });
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 glass rounded-xl shadow-2xl border z-50 overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b flex justify-between items-center bg-white/5">
                        <h3 className="font-bold text-lg">Notifications</h3>
                        {unreadCount > 0 && (
                            <button 
                                onClick={() => markAsRead()}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>
                    
                    <div className="overflow-y-auto p-2 flex flex-col gap-1">
                        {alerts.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No notifications yet
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <div 
                                    key={alert.id}
                                    onClick={() => {
                                        if (!alert.isRead) markAsRead(alert.id);
                                    }}
                                    className={`p-3 rounded-lg text-sm transition-colors cursor-pointer border border-transparent ${
                                        !alert.isRead 
                                            ? 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' 
                                            : 'hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <span className="font-semibold text-gray-200 capitalize">
                                            {alert.type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                            {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div 
                                        className="text-gray-400 text-xs leading-relaxed"
                                        dangerouslySetInnerHTML={{ 
                                            __html: alert.message.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-200">$1</strong>')
                                        }}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
