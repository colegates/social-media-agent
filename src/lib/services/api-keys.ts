import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { userApiKeys } from '@/db/schema';
import type { ApiKeyService } from '@/db/schema';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { logger } from '@/lib/logger';

export type { ApiKeyService };

const serviceLogger = logger.child({ module: 'api-keys' });

// ─────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────

/**
 * Retrieve and decrypt a single API key for a user/service pair.
 * Returns null if the key is not configured.
 */
export async function getUserApiKey(
  userId: string,
  service: ApiKeyService
): Promise<string | null> {
  const row = await db.query.userApiKeys.findFirst({
    where: and(eq(userApiKeys.userId, userId), eq(userApiKeys.service, service)),
    columns: { encryptedKey: true },
  });

  if (!row) return null;

  try {
    return decrypt(row.encryptedKey);
  } catch (err) {
    serviceLogger.error({ userId, service, err }, 'Failed to decrypt API key');
    return null;
  }
}

/**
 * Retrieve and decrypt multiple API keys for a user in a single DB query.
 * Returns a map of service → plaintext key (only includes configured services).
 */
export async function getUserApiKeys(
  userId: string,
  services: ApiKeyService[]
): Promise<Partial<Record<ApiKeyService, string>>> {
  if (services.length === 0) return {};

  const rows = await db
    .select({ service: userApiKeys.service, encryptedKey: userApiKeys.encryptedKey })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), inArray(userApiKeys.service, services)));

  const result: Partial<Record<ApiKeyService, string>> = {};
  for (const row of rows) {
    try {
      result[row.service] = decrypt(row.encryptedKey);
    } catch (err) {
      serviceLogger.error({ userId, service: row.service, err }, 'Failed to decrypt API key');
    }
  }
  return result;
}

/**
 * Get all configured services for a user (with hints, without decrypting).
 * Safe to return to the client.
 */
export async function getUserApiKeyStatus(
  userId: string
): Promise<Array<{ service: ApiKeyService; keyHint: string | null; updatedAt: Date }>> {
  const rows = await db
    .select({
      service: userApiKeys.service,
      keyHint: userApiKeys.keyHint,
      updatedAt: userApiKeys.updatedAt,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId));

  return rows;
}

// ─────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────

/**
 * Save (upsert) an API key for a user/service. Encrypts before storing.
 */
export async function setUserApiKey(
  userId: string,
  service: ApiKeyService,
  plainKey: string
): Promise<void> {
  const encryptedKey = encrypt(plainKey);
  const keyHint = plainKey.length >= 4 ? `...${plainKey.slice(-4)}` : '****';

  await db
    .insert(userApiKeys)
    .values({ userId, service, encryptedKey, keyHint })
    .onConflictDoUpdate({
      target: [userApiKeys.userId, userApiKeys.service],
      set: { encryptedKey, keyHint, updatedAt: new Date() },
    });

  serviceLogger.info({ userId, service }, 'API key saved');
}

/**
 * Delete an API key for a user/service.
 */
export async function deleteUserApiKey(
  userId: string,
  service: ApiKeyService
): Promise<void> {
  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.service, service)));

  serviceLogger.info({ userId, service }, 'API key deleted');
}
