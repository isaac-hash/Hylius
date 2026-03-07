import { PrismaClient } from '@prisma/client';
import { decrypt } from './services/crypto.service';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const servers = await prisma.server.findMany();
    if (servers.length === 0) {
        console.log("No servers");
        return;
    }
    const server = servers[servers.length - 1]; // Latest server
    if (server.privateKeyEncrypted && server.keyIv) {
        const decrypted = decrypt(server.privateKeyEncrypted, server.keyIv);
        const original = fs.readFileSync('C:/Users/HP/.ssh/id_rsa', 'utf8');

        console.log("Server IP:", server.ip);
        console.log("Decrypted length:", decrypted.length);
        console.log("Original length:", original.length);
        console.log("Match exactly:", decrypted === original);

        let normalizedDecrypted = decrypted.replace(/\r\n/g, '\n');
        let normalizedOriginal = original.replace(/\r\n/g, '\n');

        console.log("Match exactly (normalized \\n):", normalizedDecrypted === normalizedOriginal);

        if (normalizedDecrypted !== normalizedOriginal) {
            console.log("\n--- First few mismatches (normalized) ---");
            let diffs = 0;
            for (let i = 0; i < Math.max(normalizedDecrypted.length, normalizedOriginal.length); i++) {
                if (normalizedDecrypted[i] !== normalizedOriginal[i]) {
                    console.log(`Pos ${i}: decrypted=${JSON.stringify(normalizedDecrypted[i])} (${normalizedDecrypted.charCodeAt(i)}), original=${JSON.stringify(normalizedOriginal[i])} (${normalizedOriginal.charCodeAt(i)})`);
                    diffs++;
                    if (diffs > 5) break;
                }
            }
        }
    } else {
        console.log("Server has no encrypted key");
    }
}
void void void main().finally(() => prisma.$disconnect());
