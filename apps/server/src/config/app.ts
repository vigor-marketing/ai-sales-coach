import path from 'path';

export const APP_ID = 'ai-sales-coach';
export const APP_VERSION = process.env.APP_VERSION || '1.0.0';

export function getAppBasePath(): string {
  const configured = process.env.APP_BASE_PATH?.trim();
  if (!configured || configured === '/') return '';
  return `/${configured.replace(/^\/+|\/+$/g, '')}`;
}

export function getApiPaths(): string[] {
  const basePath = getAppBasePath();
  return [...new Set(['/api', `${basePath}/api`].filter(Boolean))];
}

export function getAppStaticPath(currentDir: string): string {
  return path.join(currentDir, '../../web/dist');
}

export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGIN || process.env.WORKBENCH_ORIGIN || '';
  return configured.split(',').map(origin => origin.trim()).filter(Boolean);
}
