import fs from 'fs';
import path from 'path';

/**
 * Persistent upload storage shared by all upload routes.
 * UPLOADS_DIR is resolved lazily because dotenv is loaded during app startup.
 */
export function getUploadsDir(): string {
  const configuredDir = process.env.UPLOADS_DIR?.trim();
  return configuredDir || path.join(process.cwd(), 'uploads');
}

export function ensureUploadsDir(): string {
  const uploadsDir = getUploadsDir();
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}
