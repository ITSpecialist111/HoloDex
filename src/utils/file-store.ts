/**
 * Temporary file store for generated presentations.
 *
 * Stores PPTX buffers in memory with a TTL so that download URLs
 * can be returned to clients (e.g. Copilot Studio) instead of
 * raw base64 blobs. Files auto-expire after the configured TTL.
 */

import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

export interface StoredFile {
  id: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
  slideCount: number;
  warnings?: string[];
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class FileStore {
  private files = new Map<string, StoredFile>();
  private ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Start the periodic cleanup timer.
   * Call once at app startup.
   */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.purgeExpired(), CLEANUP_INTERVAL_MS);
    // Don't block process exit
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Store a generated PPTX and return its download ID.
   */
  store(
    buffer: Buffer,
    fileName: string,
    slideCount: number,
    warnings?: string[],
  ): StoredFile {
    const id = randomUUID();
    const file: StoredFile = {
      id,
      fileName,
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      createdAt: Date.now(),
      slideCount,
      warnings,
    };
    this.files.set(id, file);
    logger.info(`FileStore: stored ${fileName} (${(buffer.length / 1024).toFixed(0)} KB) as ${id}`);
    return file;
  }

  /**
   * Retrieve a stored file by ID. Returns undefined if expired or not found.
   */
  get(id: string): StoredFile | undefined {
    const file = this.files.get(id);
    if (!file) return undefined;
    if (Date.now() - file.createdAt > this.ttlMs) {
      this.files.delete(id);
      return undefined;
    }
    return file;
  }

  /**
   * Build the public download URL for a stored file.
   */
  downloadUrl(id: string, baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/api/v1/downloads/${id}`;
  }

  /**
   * Remove all expired files.
   */
  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    for (const [id, file] of this.files) {
      if (now - file.createdAt > this.ttlMs) {
        this.files.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      logger.info(`FileStore: purged ${purged} expired files, ${this.files.size} remaining`);
    }
  }

  /** Current number of stored files (for health checks). */
  get size(): number {
    return this.files.size;
  }
}

/** Singleton file store instance */
export const fileStore = new FileStore();
