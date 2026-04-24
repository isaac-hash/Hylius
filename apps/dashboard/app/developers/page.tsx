import Link from "next/link";
import { AuthProvider } from "@/providers/auth.provider";

export const metadata = {
  title: "Developers | Hylius",
  description: "The technical documentation and trust center for deploying modern applications on Hylius.",
};

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 overflow-x-hidden">
      {/* Navigation */}
      <nav className="w-full py-6 relative z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
              <span className="text-xl">H</span>
            </div>
            <span className="font-display font-bold text-2xl tracking-tight">Hylius</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <a href="https://hylius.instatus.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Status</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.1] mb-6">
                Built for <span className="text-gradient">Engineers.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Connect your VPS, run a single command, and let our orchestration engine handle the rest. Native support for Docker, Railpack, and Nixpacks.
            </p>
            <div className="flex justify-center gap-4">
                <Link
                    href="/docs"
                    className="px-8 py-4 rounded-2xl bg-blue-600 text-center font-bold text-lg hover:bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all hover:-translate-y-1"
                >
                    Read the Documentation
                </Link>
                <a
                    href="https://github.com/Hylius-org"
                    target="_blank"
                    rel="noreferrer"
                    className="px-8 py-4 rounded-2xl border border-white/10 bg-white/5 font-bold text-lg hover:bg-white/10 transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                    GitHub Org
                </a>
            </div>
        </div>
      </section>

      {/* Quick Start Code Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Zero to Deployed in Seconds</h2>
            <div className="glass rounded-2xl p-6 md:p-8 border border-white/10 relative shadow-2xl bg-black/50">
                <div className="absolute top-0 right-0 p-4">
                    <span className="text-xs text-gray-500 font-mono bg-white/5 px-3 py-1 rounded-full">Terminal</span>
                </div>
                <pre className="font-mono text-sm md:text-base leading-loose text-gray-300">
                    <span className="text-gray-500">Deploy your app</span><br/>
                    <span className="text-blue-400">hylius</span> deploy --env production
                </pre>
            </div>
        </div>
      </section>

      {/* Framework Grid Section */}
      <section className="py-16 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4">Bring Your Own Framework</h2>
                <p className="text-gray-400">Hylius automatically detects and builds native images for all major runtimes.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                {[
                    { name: 'Next.js', tag: 'Node', icon: 'https://cdn.simpleicons.org/nextdotjs/white' },
                    { name: 'Laravel', tag: 'PHP', icon: 'https://cdn.simpleicons.org/laravel/FF2D20' },
                    { name: 'FastAPI', tag: 'Python', icon: 'https://cdn.simpleicons.org/fastapi/009688' },
                    { name: 'Go', tag: 'Native', icon: 'https://cdn.simpleicons.org/go/00ADD8' },
                    { name: 'Nuxt', tag: 'Node', icon: 'https://cdn.simpleicons.org/nuxt/00C58E' },
                    { name: 'Express', tag: 'Node', icon: 'https://cdn.simpleicons.org/express/white' },
                    { name: 'Django', tag: 'Python', icon: 'https://cdn.simpleicons.org/django/092E20' },
                    { name: 'Docker', tag: 'Custom', icon: 'https://cdn.simpleicons.org/docker/2496ED' },
                ].map((fw) => (
                    <div key={fw.name} className="flex flex-col items-center justify-center p-6 glass rounded-xl border border-white/5 hover:border-blue-500/30 transition-all hover:-translate-y-1">
                        <img src={fw.icon} alt={`${fw.name} logo`} className="w-12 h-12 mb-4 drop-shadow-md" />
                        <span className="font-bold text-lg mb-2">{fw.name}</span>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">{fw.tag}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Join the Community</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                Connect with hundreds of developers building the future of Africa's web ecosystem on Hylius. Get support, share deployments, and request features.
            </p>
            <a 
                href="https://chat.whatsapp.com/F6hCrTHMernEK6fksZvxBZ" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-all font-semibold border border-[#25D366]/20"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Join Hylius WhatsApp Group
            </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
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
