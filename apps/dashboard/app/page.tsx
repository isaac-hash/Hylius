"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth.provider";
import { useEffect, useState } from "react";

interface Plan {
    id: string;
    name: string;
    description: string | null;
    amount: number;
    currency: string;
    interval: string;
}

export default function LandingPage() {
    const { token } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        fetch("/api/plans")
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setPlans(data); })
            .catch(() => {})
            .finally(() => setPlansLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 overflow-x-hidden">
            {/* Navigation */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "glass py-3" : "py-6"}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
                            <span className="text-xl">H</span>
                        </div>
                        <span className="font-display font-bold text-2xl tracking-tight">Hylius</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <Link href="#features" className="hover:text-white transition-colors">Features</Link>
                        <Link href="/developers" className="hover:text-white transition-colors">Developers</Link>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
                        <a href="https://hylius.instatus.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Status</a>
                    </div>

                    <div className="flex items-center gap-4">
                        {token ? (
                            <Link 
                                href="/dashboard" 
                                className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-all"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href="/login" className="text-sm font-medium hover:text-blue-400 transition-colors">Sign In</Link>
                                <Link 
                                    href="/register" 
                                    className="px-5 py-2.5 rounded-full bg-blue-600 font-semibold text-sm hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="max-w-4xl animate-reveal">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-bold tracking-widest uppercase mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            Now in Public Beta
                        </div>
                        <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.1] mb-8">
                            Deploy anywhere in Africa. <br />
                            <span className="text-gradient">Own everything.</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
                            Connect your VPS, on any African hosting provider, and deploy full-stack apps, databases, and APIs in seconds. No per-server fees. No project limits. Your infrastructure, our platform.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link 
                                href="/register" 
                                className="px-8 py-4 rounded-2xl bg-blue-600 text-center font-bold text-lg hover:bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-1"
                            >
                                Deploy Your First App
                            </Link>
                            <Link
                                href="/docs"
                                className="px-8 py-4 rounded-2xl border border-white/10 bg-white/5 font-bold text-lg hover:bg-white/10 transition-all text-center"
                            >
                                Read the Docs
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Animated Background Elements */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>
                
                {/* Visual Accent */}
                <div className="absolute right-0 top-1/3 w-1/2 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-neutral-950/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="mb-16">
                        <h2 className="font-display text-4xl font-bold mb-4">Engineered for Performance.</h2>
                        <p className="text-gray-400 max-w-xl">Everything you need to ship production-grade software without the infrastructure overhead.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                title: "No project limits",
                                desc: "Deploy as many apps, databases, and APIs as you want. Your VPS specs are your only limits.",
                                icon: "🚀"
                            },
                            {
                                title: "4 Servers on Pro",
                                desc: "Manage up to 4 servers on our Pro plan with absolutely no per-server charge. It's yours.",
                                icon: "🌍"
                            },
                            {
                                title: "Managed Databases",
                                desc: "One-click Postgres, Redis, and MongoDB clusters provisioned on YOUR VPS, not ours.",
                                icon: "💾"
                            },
                            {
                                title: "Preview URLs",
                                desc: "Automatic preview environments for every pull request to test changes before production.",
                                icon: "🔗"
                            },
                            {
                                title: "Starting at ₦5,000",
                                desc: "Affordable and transparent pricing tailored for African developers.",
                                icon: "💳"
                            },
                            {
                                title: "African Server Focus",
                                desc: "Coming soon: We are partnering with African hosting providers to bring servers closer to you.",
                                icon: "📡"
                            }
                        ].map((f, i) => (
                            <div key={i} className="glass p-8 rounded-3xl group hover:border-blue-500/50 transition-all hover:-translate-y-2">
                                <div className="text-4xl mb-6">{f.icon}</div>
                                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Terminal Mockup */}
            <section className="py-32 overflow-hidden">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="glass rounded-[32px] p-2 md:p-4 border border-white/5 relative bg-neutral-900/40">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent pointer-events-none rounded-[32px]"></div>
                        
                        {/* Fake Browser Top */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 mb-4">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
                            </div>
                            <div className="mx-auto bg-white/5 px-4 py-1 rounded-lg text-[10px] text-gray-500 font-mono tracking-tight">
                                deploy.hylius.com/project-delta
                            </div>
                        </div>

                        <div className="p-6 font-mono text-sm">
                            <div className="flex gap-4 mb-2">
                                <span className="text-blue-500">➜</span>
                                <span className="text-white">hylius deploy --env production</span>
                            </div>
                            <div className="text-gray-500 mb-2">[17:21:04] Fetching repository metadata...</div>
                            <div className="text-gray-500 mb-2">[17:21:05] Building Docker image: <span className="text-blue-400">hylius-app:v2.4.1</span></div>
                            <div className="flex gap-4 mb-2">
                                <span className="text-green-500">✔</span>
                                <span className="text-gray-300">Image build successful (4.2s)</span>
                            </div>
                            <div className="text-gray-500 mb-2">[17:21:10] Pushing to registry...</div>
                            <div className="text-gray-500 mb-4">[17:21:12] Spinning up containers on <span className="text-purple-400">vps-lag-01</span></div>
                            
                            <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-xs animate-pulse">
                                DEPLOYMENT SUCCESSFUL: https://delta.hylius.app
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="mb-16 text-center">
                        <h2 className="font-display text-4xl font-bold mb-4">Simple, Transparent Pricing.</h2>
                        <p className="text-gray-400 max-w-xl mx-auto">Pick a plan that fits your team. Upgrade or cancel anytime.</p>
                    </div>

                    {plansLoading ? (
                        <div className="flex items-center justify-center gap-3 py-16 text-gray-500">
                            <span className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></span>
                            Loading plans...
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">No plans available right now. Check back soon.</div>
                    ) : (
                        <div className={`grid gap-8 ${
                            plans.length === 1 ? "max-w-sm mx-auto" :
                            plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" :
                            "md:grid-cols-3"
                        }`}>
                            {plans.map((plan, i) => {
                                const isPro = plan.name.toLowerCase().includes("pro");
                                const currencySymbol = plan.currency === "USD" ? "$" : plan.currency === "NGN" ? "₦" : plan.currency;
                                const interval = plan.interval.toLowerCase().replace("ly", "");
                                return (
                                    <div key={plan.id} className={`relative flex flex-col p-8 rounded-3xl border transition-all hover:-translate-y-1 ${
                                        isPro
                                            ? "bg-blue-600/10 border-blue-500/40 shadow-[0_0_40px_rgba(37,99,235,0.15)]"
                                            : "glass border-white/10"
                                    }`}>
                                        {isPro && (
                                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-wide shadow">POPULAR</span>
                                            </div>
                                        )}
                                        <div className="mb-6">
                                            <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                                            <p className="text-gray-400 text-sm">{plan.description || "Get started with our features."}</p>
                                        </div>
                                        <div className="mb-8">
                                            <span className="text-5xl font-extrabold">{currencySymbol}{plan.amount.toLocaleString()}</span>
                                            <span className="text-gray-500 text-base font-normal ml-1">/{interval}</span>
                                        </div>
                                        <ul className="space-y-3 mb-10 flex-grow text-sm text-gray-300">
                                            <li className="flex items-center gap-2.5">
                                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                                                Managed Cloud Servers
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                                                SSH Key Management
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                                                Git-Powered CI/CD
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                                                Zero-Downtime Deployments
                                            </li>
                                        </ul>
                                        <Link
                                            href={token ? `/billing/payment/${plan.id}` : "/register"}
                                            className={`w-full py-3.5 rounded-2xl text-center font-semibold text-sm transition-all ${
                                                isPro
                                                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                                                    : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                                            }`}
                                        >
                                            {token ? "Select Plan" : "Get Started"}
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:row items-center justify-between gap-8 md:flex-row">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-lg">
                            <span className="text-lg">H</span>
                        </div>
                        <span className="font-display font-bold text-xl tracking-tight">Hylius</span>
                    </div>
                    <div className="flex gap-8 text-sm text-gray-500">
                        <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
                        <Link href="/developers" className="hover:text-white transition-colors">Developers</Link>
                        <a href="https://hylius.instatus.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Status</a>
                    </div>
                    <div className="text-sm text-gray-500">
                        © 2026 Hylius Cloud. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
