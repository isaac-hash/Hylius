"use client";

import { useState, useEffect } from "react";
import DeployTemplateModal from "../../../components/templates/DeployTemplateModal";
import { AuthGuard } from "../../../components/AuthGuard";

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    useEffect(() => {
        fetch("/api/templates")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setTemplates(data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const categories = ["all", ...Array.from(new Set(templates.map((t: any) => t.category))).sort()];

    const filteredTemplates = categoryFilter === "all" 
        ? templates 
        : templates.filter(t => t.category === categoryFilter);

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse flex items-center gap-3 text-neutral-500">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Loading templates...
                </div>
            </div>
        );
    }

    return (
        <AuthGuard>
            <div className="p-8 pb-32 max-w-7xl mx-auto animate-fade-in">
                <div className="mb-10">
                <h1 className="text-3xl font-bold font-display tracking-tight text-white mb-2">
                    One-Click Templates
                </h1>
                <p className="text-neutral-400 max-w-2xl">
                    Deploy production-ready applications to your servers instantly. Hylius automatically provisions and links managed databases to your template when needed.
                </p>
            </div>

            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-4 hide-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                            categoryFilter === cat 
                                ? "bg-white text-black" 
                                : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                        }`}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((template) => (
                    <div 
                        key={template.id} 
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all hover:-translate-y-1 group"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-neutral-800 border border-neutral-700 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                                {template.icon}
                            </div>
                            <div className="flex gap-1.5 flex-wrap justify-end max-w-[50%]">
                                {template.requiresDatabase?.map((db: string) => (
                                    <span key={db} title={`Requires ${db}`} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase font-bold rounded-full">
                                        {db}
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
                        <p className="text-neutral-400 text-sm mb-6 line-clamp-2">
                            {template.description}
                        </p>
                        
                        <div className="flex items-center justify-between mt-auto">
                            <div className="flex gap-2">
                                {template.tags?.slice(0, 2).map((tag: string) => (
                                    <span key={tag} className="text-xs text-neutral-500 bg-black px-2 py-1 rounded-md">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => setSelectedTemplate(template)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all group-hover:scale-105"
                            >
                                Deploy
                            </button>
                        </div>
                    </div>
                ))}

                {filteredTemplates.length === 0 && (
                    <div className="col-span-full py-16 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
                        No templates found in this category.
                    </div>
                )}
            </div>

            {selectedTemplate && (
                <DeployTemplateModal 
                    template={selectedTemplate} 
                    onClose={() => setSelectedTemplate(null)} 
                />
            )}
        </div>
        </AuthGuard>
    );
}
