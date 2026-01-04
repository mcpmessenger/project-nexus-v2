/**
 * Token Vault Implementation
 * AES-256-GCM encryption for user credentials
 */

const VAULT_KEY_ENV = "VAULT_ENCRYPTION_KEY";
const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits for authentication tag

/**
 * Get vault encryption key from environment (Supabase secrets)
 */
function getVaultKey(): Uint8Array {
  const keyHex = Deno.env.get(VAULT_KEY_ENV);
  if (!keyHex) {
    throw new Error("VAULT_ENCRYPTION_KEY not found in environment");
  }
  
  // Key should be 64 hex characters = 32 bytes (256 bits) for AES-256
  // Convert hex string to bytes
  if (keyHex.length !== 64) {
    throw new Error(`VAULT_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyHex.length}`);
  }
  
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const hexChar = keyHex.substring(i * 2, i * 2 + 2);
    keyBytes[i] = parseInt(hexChar, 16);
  }
  
  return keyBytes;
}

/**
 * Encrypt a token using AES-256-GCM
 * Returns: IV (12 bytes) + Ciphertext + Tag (16 bytes) as Uint8Array
 */
export async function encryptToken(token: string): Promise<Uint8Array> {
  const keyBytes = getVaultKey();
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM },
    false,
    ["encrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
      tagLength: TAG_LENGTH * 8, // bits
    },
    key,
    data
  );
  
  // Concatenate: IV (12 bytes) + Encrypted Data + Tag (16 bytes)
  const result = new Uint8Array(IV_LENGTH + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), IV_LENGTH);
  
  return result;
}

/**
 * Decrypt a token using AES-256-GCM
 * Input: Uint8Array containing IV (12 bytes) + Ciphertext + Tag (16 bytes)
 */
export async function decryptToken(encrypted: Uint8Array): Promise<string> {
  const keyBytes = getVaultKey();
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM },
    false,
    ["decrypt"]
  );
  
  // Extract IV (first 12 bytes)
  const iv = encrypted.slice(0, IV_LENGTH);
  
  // Rest is ciphertext + tag
  const ciphertext = encrypted.slice(IV_LENGTH);
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
      tagLength: TAG_LENGTH * 8, // bits
    },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypt a JSON object (for server config)
 */
export async function encryptConfig(config: Record<string, unknown>): Promise<Uint8Array> {
  const jsonString = JSON.stringify(config);
  return encryptToken(jsonString);
}

/**
 * Decrypt a JSON object (for server config)
 */
export async function decryptConfig(encrypted: Uint8Array): Promise<Record<string, unknown>> {
  const jsonString = await decryptToken(encrypted);
  return JSON.parse(jsonString);
}
