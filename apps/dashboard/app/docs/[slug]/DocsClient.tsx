"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

interface NavItem {
  label: string;
  slug: string;
}

export default function DocsClient({
  html,
  prev,
  next,
  label
}: {
  html: string;
  prev: NavItem | null;
  next: NavItem | null;
  label: string;
}) {
  const pathname = usePathname();

  // Scroll to hash if jumping to sub-headers via deep-link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [pathname]);

  return (
    <>
        <div className="text-[0.8rem] text-blue-500 font-bold mb-2 tracking-widest font-display">DOCUMENTATION</div>
      
        <div 
            className="prose prose-invert prose-blue max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-headings:font-display prose-headings:font-bold prose-h1:text-4xl hover:prose-a:text-blue-400 prose-a:transition-colors prose-img:rounded-xl prose-img:border prose-img:border-white/10 prose-th:bg-blue-500/10 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-white/5"
            dangerouslySetInnerHTML={{ __html: html }} 
        />

        <div className="mt-20 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-4 justify-between">
            {prev ? (
                <Link 
                    href={`/docs/${prev.slug}`}
                    className="flex flex-col gap-1.5 p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all md:w-1/2 group"
                >
                    <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Previous</span>
                    <span className="text-blue-400 group-hover:text-blue-300 font-medium transition-colors">← {prev.label}</span>
                </Link>
            ) : <div className="md:w-1/2" />}

            {next && (
                <Link 
                    href={`/docs/${next.slug}`}
                    className="flex flex-col gap-1.5 p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all text-right md:w-1/2 group"
                >
                    <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Next</span>
                    <span className="text-blue-400 group-hover:text-blue-300 font-medium transition-colors">{next.label} →</span>
                </Link>
            )}
        </div>
    </>
  );
}
