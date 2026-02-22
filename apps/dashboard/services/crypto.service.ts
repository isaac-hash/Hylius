import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16;

/**
 * Returns the encryption key from environment.
 * Must be a 64-char hex string (32 bytes).
 */
function getKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            'ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes). ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
    return Buffer.from(hex, 'hex');
}

export interface EncryptedPayload {
    encrypted: string; // base64
    iv: string;        // base64
}

/**
 * Encrypt a plaintext SSH private key using AES-256-GCM.
 * Returns the encrypted data + IV as base64 strings.
 */
export function encrypt(plaintext: string): EncryptedPayload {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Append auth tag to encrypted data
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([
        Buffer.from(encrypted, 'base64'),
        authTag,
    ]);

    return {
        encrypted: combined.toString('base64'),
        iv: iv.toString('base64'),
    };
}

/**
 * Decrypt an encrypted SSH private key using AES-256-GCM.
 * Returns the plaintext — NEVER persist this value.
 */
export function decrypt(encryptedBase64: string, ivBase64: string): string {
    const key = getKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const combined = Buffer.from(encryptedBase64, 'base64');

    // Split encrypted data and auth tag
    const encrypted = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    const final = decipher.final();

    return Buffer.concat([decrypted, final]).toString('utf8');
}

export const CryptoService = { encrypt, decrypt };
