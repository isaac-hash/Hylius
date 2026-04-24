export function simpleMarkdownToHtml(markdown: string): string {
    let html = markdown;
    
    // Process code blocks FIRST
    html = html.replace(/```[a-z]*\n([\s\S]*?)\n```/gim, '<pre class="bg-black/50 border border-white/10 p-4 rounded-xl overflow-x-auto my-6 text-sm text-blue-300"><code>$1</code></pre>');

    // Process tables
    html = html.replace(/(?:^\|.*\|$\n?)+/gim, (match) => {
        const rows = match.trim().split('\n');
        let tableHtml = '<div class="overflow-x-auto my-8"><table class="w-full text-left border-collapse text-sm">';
        rows.forEach((row, index) => {
            if (row.includes('|---')) return;
            // Ignore empty strings at start/end due to pipe splitting
            const parts = row.split('|');
            const cells = parts.slice(1, parts.length - 1).map(c => c.trim());
            tableHtml += '<tr class="border-b border-white/10 hover:bg-white/5">';
            cells.forEach(cell => {
                if (index === 0) {
                    tableHtml += `<th class="p-3 font-bold bg-white/5 text-gray-200">${cell}</th>`;
                } else {
                    tableHtml += `<td class="p-3 text-gray-400">${cell}</td>`;
                }
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</table></div>';
        return tableHtml;
    });

    // Convert horizontal rules
    html = html.replace(/^\s*---\s*$/gm, '<hr class="border-white/10 my-12" />');

    // Convert blockquotes
    html = html.replace(/^\s*>\s+(.*$)/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 italic text-gray-400 my-6 bg-blue-500/5">$1</blockquote>');

    // Convert headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-2xl font-bold mt-8 mb-4">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-3xl font-bold mt-10 mb-4">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-4xl font-bold mt-12 mb-6">$1</h1>');
    
    // Convert bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Convert images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" class="rounded-xl border border-white/10 shadow-lg mt-8 mb-6 mx-auto w-full" />');
    
    // Convert links (only replacing those that aren't already part of an img tag)
    html = html.replace(/(?<!<img[^>]*|\!)\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" class="text-blue-500 hover:underline">$1</a>');
    
    // Convert lists
    html = html.replace(/^\s*-\s+(.*)$/gim, '<li class="ml-6 list-disc mb-2 text-gray-300">$1</li>');
    
    // Wrap paragraphs (double newline to <p>)
    const blocks = html.split(/\n\s*\n/);
    html = blocks.map(block => {
        const tBlock = block.trim();
        if (tBlock.startsWith('<h') || tBlock.startsWith('<li') || tBlock.startsWith('<img') || 
            tBlock.startsWith('<!--') || tBlock.startsWith('<div') || tBlock.startsWith('<pre') || 
            tBlock.startsWith('<hr') || tBlock.startsWith('<blockquote')) {
            if (tBlock.startsWith('<li')) {
                return `<ul class="mb-6">${block}</ul>`;
            }
            return block;
        }
        if (!tBlock) return '';
        return `<p class="mb-6 leading-relaxed text-gray-300">${block}</p>`;
    }).join('\n');

    return html;
}
