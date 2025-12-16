import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_TOKEN } from '../database/database.module';
import { type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { apiKeys, type ApiKey, type ApiKeyPermissions } from '../database/schema/api-keys';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { CreateApiKeyDto, ListApiKeysQueryDto, UpdateApiKeyDto } from './dto/api-key.dto';
import type { AuthContext } from '../auth/types';

const KEY_PREFIX = 'sk_live_';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @Inject(DRIZZLE_TOKEN)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(auth: AuthContext, dto: CreateApiKeyDto) {
    if (!auth.organizationId) {
      throw new InternalServerErrorException('Organization ID missing in context');
    }

    const { key: plainKey, id: keyId } = this.generateKeyWithId();
    const keyHash = await bcrypt.hash(plainKey, 10);

    const [apiKey] = await this.db
      .insert(apiKeys)
      .values({
        name: dto.name,
        description: dto.description,
        keyHash,
        keyPrefix: KEY_PREFIX,
        keyHint: keyId,
        permissions: dto.permissions,
        organizationId: dto.organizationId ?? auth.organizationId,
        createdBy: auth.userId || 'system',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        rateLimit: dto.rateLimit,
        isActive: true,
      })
      .returning();

    return { apiKey, plainKey };
  }

  async list(auth: AuthContext, query: ListApiKeysQueryDto) {
    if (!auth.organizationId) {
      return [];
    }

    const conditions = [eq(apiKeys.organizationId, auth.organizationId)];
    
    if (query.isActive !== undefined) {
      conditions.push(eq(apiKeys.isActive, query.isActive));
    }

    return this.db
      .select()
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  }

  async get(auth: AuthContext, id: string) {
    if (!auth.organizationId) {
      throw new NotFoundException('API key not found');
    }

    const [apiKey] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, auth.organizationId)));

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  async update(auth: AuthContext, id: string, dto: UpdateApiKeyDto) {
    if (!auth.organizationId) {
      throw new NotFoundException('API key not found');
    }

    const [apiKey] = await this.db
      .update(apiKeys)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, auth.organizationId)))
      .returning();

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  async delete(auth: AuthContext, id: string) {
    if (!auth.organizationId) {
      throw new NotFoundException('API key not found');
    }

    const result = await this.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, auth.organizationId)));

    if (result.rowCount === 0) {
      throw new NotFoundException('API key not found');
    }
  }

  async validateKey(plainKey: string): Promise<ApiKey | null> {
    // Basic format check
    if (!plainKey.startsWith(KEY_PREFIX)) {
      return null;
    }

    // Since we can't look up by hash directly (salt is random), we need another strategy if we had millions of keys.
    // However, for security, we search by organization logic usually, but here we just need to validate a key from anywhere.
    // To make this efficient, strictly we should store a "keyId" part in the key string, e.g. sk_live_<id>_<random>.
    // But per our design, we scan? No, that's bad.
    // Ideally we'd have a key ID or prefix that is searchable. 
    // Wait, bcrypt verification requires the hash. We can't query by plaintext.
    
    // REVISION to plan: We need to store a lookup index or valid hash.
    // Actually, widespread practice is `prefix_publicID_secret`.
    // Let's rely on the fact we probably don't have millions of keys yet? No, that's bad engineering.
    // Let's modify the key format to include a lookup component if possible, OR
    // we just query for all active keys that *could* match? No.
    
    // FIX: We need to lookup by something.
    // Current schema has `keyHash` unique.
    // Common pattern: Store `truncated` key or a `token_id` in the DB.
    // Let's stick to the plan but realize the plan didn't specify the lookup mechanism efficiently.
    // 
    // Hack: We can use the first few chars of the random part as a "lookup index" if we wanted, 
    // but better is to change the key format slightly to include a public ID.
    // 
    // `sk_live_<public_id>_<secret>`
    // 
    // Let's adjust the generation to: `sk_live_<8_chars_random>_<24_chars_random>` 
    // and store the 8 chars as `keyHint` (which we already have) BUT `keyHint` in schema was "last 4".
    // 
    // Let's assume we can't change the schema excessively now without another migration.
    // Wait, I *just* created the schema. I can iterate on it if I haven't run it? 
    // No, I've already written the migration file. I should treat it as immutable or append.
    // 
    // ACTUALLY: The best way with standard bcrypt is to just iterate? NO.
    // 
    // Alternative: We will iterate over all keys? No.
    // 
    // Real Solution: 
    // We should have a `access_key_id` and `secret_access_key` pair? 
    // Or just embed the ID in the key.
    // 
    // Let's use the `key_hint` or a new field `short_id` for lookup?
    // I can generate keys like: `sk_live_<base62_id>_<secret>`.
    // 
    // Let's try to find a key by matching the hash? 
    // Bcrypt verify is `compare(plain, hash)`. You need the hash designated.
    // 
    // Okay, I will modify `ApiKeysService` to not implement `validateKey` efficiently yet 
    // and IMMEDIATELY add a migration to add a `lookup_hash` or similar? 
    // 
    // actually, let's use the `keyHint` as a lookup?
    // If I make the key `sk_live_<hint>_<secret>`, I can look up by hint.
    // The schema says `keyHint` is varchar(8).
    // 
    // Let's change the key generation strategy:
    // Key = `sk_live_` + `8_char_id` + `_` + `24_char_secret`
    // Total length = 8 + 8 + 1 + 24 = 41 chars.
    // 
    // Schema `keyHint` is 8 chars. I will store the `8_char_id` there.
    // Then `validateKey` extracts the ID, looks up the record, then bcrypt compares.
    // 
    // PROCEEDING with this adjusted logic.
    
    const parts = plainKey.split('_');
    // Expected: sk, live, <8-char-id>, <secret>
    // But my current generation was simple.
    // Let's adjust generation to: `sk_live_<8chars>_<secret>`
    // The `validateKey` will parse this.
    
    if (parts.length !== 4) return null;
    const [sk, env, id, secret] = parts;
    if (sk !== 'sk' || env !== 'live') return null;
    
    // Look up by keyHint (which will store the ID)
    const candidates = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHint, id), eq(apiKeys.isActive, true)));
      
    for (const key of candidates) {
      const match = await bcrypt.compare(plainKey, key.keyHash);
      if (match) {
        // Check expiration
        if (key.expiresAt && key.expiresAt < new Date()) {
          return null;
        }
        
        // Update stats (async, don't await)
        this.updateUsage(key.id);
        
        return key;
      }
    }
    
    return null;
  }
  
  private async updateUsage(id: string) {
    try {
      await this.db
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          usageCount: sql`${apiKeys.usageCount} + 1`,
        })
        .where(eq(apiKeys.id, id));
    } catch (e) {
      this.logger.error(`Failed to update usage for key ${id}`, e);
    }
  }
  
  // Adjusted generation to match the lookup strategy
  private generateKeyWithId(): { key: string; id: string } {
    const id = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    const secret = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    const key = `${KEY_PREFIX}${id}_${secret}`;
    return { key, id };
  }
  

}
