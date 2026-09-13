/**
 * Multi-device synchronization bridge (PC <-> Mobile <-> Vercel)
 * Allows seamless, zero-config transfer of all system users, credentials, and settings
 * across devices via URL payload, QR code, and central server endpoints.
 */

export interface SyncPayload {
  users: any[];
  institutionName?: string;
  institutionLogo?: string;
  adminEmail?: string;
  timestamp: string;
  version: string;
}

/**
 * Encodes sync data safely with UTF-8 character support (accents, Spanish characters)
 */
export function encodeSyncPayload(data: Partial<SyncPayload>): string {
  try {
    const payload: SyncPayload = {
      users: data.users || [],
      institutionName: data.institutionName,
      institutionLogo: data.institutionLogo,
      adminEmail: data.adminEmail,
      timestamp: new Date().toISOString(),
      version: '2.0'
    };

    const jsonStr = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.error('Error encoding sync payload:', err);
    return '';
  }
}

/**
 * Decodes sync data with UTF-8 character recovery
 */
export function decodeSyncPayload(str: string): SyncPayload | null {
  if (!str || typeof str !== 'string') return null;
  try {
    let cleaned = str.trim();
    // In case the user pasted a full URL or code with prefix
    if (cleaned.includes('sync=')) {
      cleaned = cleaned.split('sync=')[1].split('&')[0];
    }
    let base64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.users)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('Error decoding sync payload:', err);
    return null;
  }
}

/**
 * Generates a full URL containing the sync payload for mobile scanning
 */
export function generateMobileSyncUrl(baseUrl: string, data: Partial<SyncPayload>): string {
  const payloadStr = encodeSyncPayload(data);
  if (!payloadStr) return baseUrl;
  
  // Clean trailing slash
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}#sync=${encodeURIComponent(payloadStr)}`;
}

/**
 * Checks current browser URL (search or hash) for an incoming sync payload
 */
export function extractSyncPayloadFromUrl(): SyncPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    
    let raw = '';
    if (hash.includes('sync=')) {
      raw = hash.split('sync=')[1].split('&')[0];
    } else if (search.includes('sync=')) {
      const params = new URLSearchParams(search);
      raw = params.get('sync') || '';
    }

    if (raw) {
      return decodeSyncPayload(decodeURIComponent(raw));
    }
  } catch (e) {
    console.warn('Could not extract sync payload from URL:', e);
  }
  return null;
}
