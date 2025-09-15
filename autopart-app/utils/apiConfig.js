// Simple API base helper used by the frontend to avoid hardcoded localhost:5000 everywhere.
import Constants from 'expo-constants';

const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
export const API_BASE = `http://${devHost}:5000`;

export function apiUrl(path) {
  if (!path) return `${API_BASE}/api`;
  // if caller already provided a full API path (starts with /api), don't double-prefix
  if (path.startsWith('/api')) {
    return `${API_BASE}${path}`;
  }

  // ensure API paths are under /api
  if (path.startsWith('/')) return `${API_BASE}/api${path}`;
  return `${API_BASE}/api/${path}`;
}
