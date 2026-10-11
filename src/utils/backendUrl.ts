export const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

export const backendApiUrl = (path: string) => `${backendUrl}${path}`;
