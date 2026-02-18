const fs = require('fs');
const filename = process.argv[2];

try {
    // Try UTF-16LE first as PowerShell '>' defaults to it
    let content = fs.readFileSync(filename, 'utf16le');
    // Basic check if it looks like HTML
    if (content.includes('<') && content.includes('>')) {
        console.log(content);
    } else {
        // Fallback to UTF-8
        content = fs.readFileSync(filename, 'utf8');
        console.log(content);
    }
} catch (err) {
    console.error(`Error reading file: ${err.message}`);
}
