"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth.provider";
import FeatureInstallModal from "@/components/marketplace/FeatureInstallModal";
import Link from "next/link";

interface Feature {
    id: string;
    name: string;
    description: string;
    tags: string[];
    icon: React.ReactNode;
    gradient: string;
    borderGlow: string;
    requiresMinRam: boolean;
    comingSoon?: boolean;
}

const AnalyticsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
);

const SpeedIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
);

const UptimeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const FEATURES: Feature[] = [
    {
        id: "umami",
        name: "Traffic Analytics",
        description: "Privacy-first, open-source web analytics. Track pageviews, sessions, referrers, and custom events — all self-hosted on your VPS with zero third-party data sharing.",
        tags: ["Web Analytics", "Privacy"],
        icon: <AnalyticsIcon />,
        gradient: "from-violet-600/20 via-purple-600/10 to-fuchsia-600/5",
        borderGlow: "hover:border-violet-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
        requiresMinRam: true,
    },
    {
        id: "pagespeed",
        name: "Performance & SEO",
        description: "Automated Core Web Vitals monitoring. Track LCP, FID, CLS, and SEO scores over time with West African 4G throttle profiles.",
        tags: ["Performance", "SEO"],
        icon: <SpeedIcon />,
        gradient: "from-emerald-600/20 via-green-600/10 to-teal-600/5",
        borderGlow: "hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
        requiresMinRam: false,
    },
    {
        id: "uptime",
        name: "Uptime Monitor",
        description: "30-second heartbeat pings to all deployed services. Instant downtime alerts via WhatsApp and Email, powered by the Hylius agent running on your VPS.",
        tags: ["Monitoring", "Alerts"],
        icon: <UptimeIcon />,
        gradient: "from-amber-600/20 via-orange-600/10 to-yellow-600/5",
        borderGlow: "hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
        requiresMinRam: false,
        comingSoon: true,
    },
];

export default function MarketplacePage() {
    const { token, organization } = useAuth();
    const isFreePlan = !organization?.plan || organization.plan === "FREE";

    const [installModal, setInstallModal] = useState<{ open: boolean; feature: Feature | null }>({ open: false, feature: null });
    const [installing, setInstalling] = useState(false);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [installedFeatures, setInstalledFeatures] = useState<string[]>([]);
    const [servers, setServers] = useState<{ id: string; name: string; hasTrafficAnalytics: boolean }[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>("");

    useEffect(() => {
        if (!token) return;
        fetch("/api/servers", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setServers(data);
                    const alreadyInstalled = data.filter((s: any) => s.hasTrafficAnalytics).map(() => "umami");
                    setInstalledFeatures(alreadyInstalled);
                }
            })
            .catch(() => {});
    }, [token]);

    const handleInstallClick = (feature: Feature) => {
        if (isFreePlan || feature.comingSoon) return;
        if (feature.requiresMinRam) {
            setInstallModal({ open: true, feature });
        } else {
            doInstall(feature.id);
        }
    };

    const doInstall = async (featureId: string) => {
        if (!token) return;
        setInstalling(true);
        try {
            const res = await fetch("/api/marketplace/install", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ featureId, serverId: selectedServerId || undefined }),
            });
            const data = await res.json();
            if (res.ok) {
                setInstalledFeatures((prev) => [...prev, featureId]);
                setInstallModal({ open: false, feature: null });
            } else {
                alert(data.error || "Installation failed");
            }
        } catch {
            alert("Network error");
        } finally {
            setInstalling(false);
        }
    };

    const doUninstall = async (featureId: string) => {
        if (!token) return;
        const confirmed = window.confirm(
            'Are you sure you want to uninstall this feature? This will stop and remove all associated containers, volumes, and data from your VPS. This action cannot be undone.'
        );
        if (!confirmed) return;

        setUninstalling(featureId);
        try {
            const res = await fetch('/api/marketplace/uninstall', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ featureId, serverId: selectedServerId || undefined }),
            });
            const data = await res.json();
            if (res.ok) {
                setInstalledFeatures((prev) => prev.filter((id) => id !== featureId));
                // Refresh server list to get updated state
                fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } })
                    .then(r => r.json())
                    .then(data => { if (Array.isArray(data)) setServers(data); })
                    .catch(() => {});
            } else {
                alert(data.error || 'Uninstall failed');
            }
        } catch {
            alert('Network error');
        } finally {
            setUninstalling(null);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-blue-500/30">
            <main className="py-6">
                {/* Header */}
                <header className="mb-10 animate-reveal">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="font-display text-4xl font-bold tracking-tight text-white">Marketplace</h1>
                        {isFreePlan && (
                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                                Pro Required
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400 max-w-2xl">
                        Extend your infrastructure with powerful add-ons. Install analytics, monitoring, and performance tools directly onto your VPS.
                    </p>
                </header>

                {/* Server selector */}
                {servers.length > 0 && !isFreePlan && (
                    <div className="mb-8 animate-reveal" style={{ animationDelay: "0.1s" }}>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Server</label>
                        <select
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            className="bg-gray-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 w-full max-w-xs"
                        >
                            <option value="">Select a server...</option>
                            {servers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {FEATURES.map((feature, idx) => {
                        const isInstalled = installedFeatures.includes(feature.id);
                        return (
                            <div
                                key={feature.id}
                                className={`group relative bg-gradient-to-br ${feature.gradient} rounded-2xl border border-white/[0.06] ${feature.borderGlow} transition-all duration-500 overflow-hidden animate-reveal`}
                                style={{ animationDelay: `${0.15 + idx * 0.1}s` }}
                            >
                                {/* Shimmer overlay */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -skew-x-12 group-hover:animate-pulse" />

                                <div className="relative p-6 flex flex-col h-full">
                                    {/* Top row: icon + tags */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/80 group-hover:scale-110 transition-transform duration-300">
                                            {feature.icon}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 justify-end">
                                            {feature.tags.map((tag) => (
                                                <span key={tag} className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] text-gray-400 border border-white/[0.06] rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-white/90 transition-colors">
                                        {feature.name}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-sm text-gray-400 leading-relaxed mb-6 flex-1">
                                        {feature.description}
                                    </p>

                                    {/* RAM warning badge */}
                                    {feature.requiresMinRam && (
                                        <div className="flex items-center gap-2 text-[11px] text-yellow-400/70 mb-4 bg-yellow-500/5 border border-yellow-500/10 rounded-lg px-3 py-2">
                                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
                                            Requires 2GB+ RAM on target VPS
                                        </div>
                                    )}

                                    {/* Action button */}
                                    {isFreePlan ? (
                                        <Link
                                            href="/billing"
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-500 text-sm font-semibold hover:bg-white/[0.06] hover:border-amber-500/20 hover:text-amber-400 transition-all duration-300"
                                        >
                                            <LockIcon />
                                            Upgrade to Pro
                                        </Link>
                                    ) : feature.comingSoon ? (
                                        <button
                                            disabled
                                            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-600 text-sm font-semibold cursor-not-allowed"
                                        >
                                            Coming Soon
                                        </button>
                                    ) : isInstalled ? (
                                        <div className="flex gap-2">
                                            <div
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold cursor-default flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Installed
                                            </div>
                                            <button
                                                onClick={() => doUninstall(feature.id)}
                                                disabled={uninstalling === feature.id}
                                                className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/20 hover:border-red-400/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
                                                title="Uninstall feature"
                                            >
                                                {uninstalling === feature.id ? (
                                                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleInstallClick(feature)}
                                            className="w-full px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-600/30 hover:border-blue-400/50 hover:text-blue-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 active:scale-[0.98]"
                                        >
                                            Install Feature
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Install confirmation modal */}
            <FeatureInstallModal
                isOpen={installModal.open}
                onClose={() => setInstallModal({ open: false, feature: null })}
                onConfirm={() => installModal.feature && doInstall(installModal.feature.id)}
                featureName={installModal.feature?.name || ""}
                loading={installing}
            />
        </div>
    );
}
