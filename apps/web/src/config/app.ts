const rawBasePath = import.meta.env.APP_BASE_PATH || '/';

export const APP_BASE_PATH = rawBasePath === '/'
  ? '/'
  : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`;

export const API_BASE_PATH = `${APP_BASE_PATH === '/' ? '' : APP_BASE_PATH}/api`;

export function appPath(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return APP_BASE_PATH === '/' ? normalizedPath : `${APP_BASE_PATH}${normalizedPath}`;
}
