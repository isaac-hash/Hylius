import Link from "next/link";
import { getSortedPostsData } from "@/lib/blog";

export const metadata = {
  title: "Blog | Hylius",
  description: "News, technical deep-dives, and updates from the Hylius team.",
};

export default function BlogIndexPage() {
  const allPostsData = getSortedPostsData();

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Navigation Layer - simplified for interior pages */}
      <nav className="w-full py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold shadow-[0_0_20px_rgba(37,99,235,0.4)] group-hover:scale-110 transition-transform">
              <span className="text-xl">H</span>
            </div>
            <span className="font-display font-bold text-2xl tracking-tight">Hylius</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/developers" className="hover:text-white transition-colors">Developers</Link>
            <a href="https://hylius.instatus.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Status</a>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <header className="mb-16">
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.1] mb-6">
            The Hylius <span className="text-gradient">Blog</span>
          </h1>
          <p className="text-xl text-gray-400">
            Insights on cloud infrastructure, deployment strategies, and building for the next generation of web applications.
          </p>
        </header>

        <div className="space-y-12">
          {allPostsData.length === 0 ? (
            <p className="text-gray-500">More posts coming soon.</p>
          ) : (
            allPostsData.map(({ slug, date, title, excerpt }) => (
              <article key={slug} className="group glass p-8 rounded-3xl border border-white/5 hover:border-blue-500/50 transition-all hover:-translate-y-1 block">
                <Link href={`/blog/${slug}`}>
                  <time className="text-blue-500 text-sm font-mono mb-4 block">{new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                  <h2 className="text-2xl font-bold mb-3 group-hover:text-blue-400 transition-colors">{title}</h2>
                  <p className="text-gray-400 leading-relaxed">
                    {excerpt}
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-medium text-blue-500">
                    Read article <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              </article>
            ))
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
               <span className="text-lg">H</span>
           </div>
           <span className="font-display font-bold tracking-tight">Hylius</span>
        </div>
        <div className="text-sm text-gray-500">
           © 2026 Hylius Cloud. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
