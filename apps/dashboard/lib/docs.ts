export const docsSections = [
  {
    title: "Introduction",
    items: [
      { label: "Getting Started", slug: "getting-started", icon: "⚡" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Using the Dashboard", slug: "dashboard", icon: "📊" },
      { label: "Provision a Server", slug: "provisioning", icon: "🖥️" },
      { label: "Deploy Your App", slug: "deploying", icon: "🚀" },
    ],
  },
  {
    title: "Automation",
    items: [
      { label: "CI/CD & Automation", slug: "CI-CD", icon: "⚙️" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Troubleshooting", slug: "troubleshooting", icon: "🔧" },
    ],
  },
];

export function getDocBySlug(slug: string) {
  return docsSections.flatMap(s => s.items).find(i => i.slug === slug);
}
