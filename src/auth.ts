import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('sysacad_google_access_token');

export interface GoogleAuthUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  uid?: string;
}

export const initAuth = (
  onAuthSuccess?: (user: User | GoogleAuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      const savedToken = localStorage.getItem('sysacad_google_access_token');
      const savedUser = localStorage.getItem('sysacad_google_user');
      if (savedToken && savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          cachedAccessToken = savedToken;
          if (onAuthSuccess) onAuthSuccess(parsed, savedToken);
          return;
        } catch {
          // Ignore parse error
        }
      }
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getEffectiveClientId = (): string => {
  const customId = localStorage.getItem('sysacad_custom_google_client_id');
  if (customId && customId.trim()) {
    return customId.trim();
  }
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envId && envId.trim()) {
    return envId.trim();
  }
  return firebaseConfig.oAuthClientId || '';
};

export const setCustomClientId = (clientId: string) => {
  if (clientId && clientId.trim()) {
    localStorage.setItem('sysacad_custom_google_client_id', clientId.trim());
  } else {
    localStorage.removeItem('sysacad_custom_google_client_id');
  }
};

/**
 * Direct Google Identity Services (GIS) token client request.
 * Completely bypasses Firebase Auth domain restrictions on Vercel/custom domains.
 */
function signInWithGISToken(): Promise<{ user: GoogleAuthUser; accessToken: string }> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    const clientId = getEffectiveClientId();

    if (!google?.accounts?.oauth2 || !clientId) {
      return reject(new Error('Google Identity Services no está listo o falta configurar el Client ID.'));
    }

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            return reject(new Error(`Error de autorización de Google: ${response.error_description || response.error}`));
          }
          const accessToken = response.access_token;
          if (!accessToken) {
            return reject(new Error('No se recibió token de acceso de Google.'));
          }

          let userObj: GoogleAuthUser = {
            displayName: 'Usuario Google',
            email: '',
            photoURL: '',
            uid: 'gis-' + Date.now()
          };

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userInfoRes.ok) {
              const uData = await userInfoRes.json();
              userObj = {
                displayName: uData.name || uData.given_name || 'Usuario Google',
                email: uData.email || '',
                photoURL: uData.picture || '',
                uid: uData.sub || 'gis-' + Date.now()
              };
            }
          } catch (e) {
            console.warn('No se pudo obtener información del perfil:', e);
          }

          cachedAccessToken = accessToken;
          localStorage.setItem('sysacad_google_access_token', accessToken);
          localStorage.setItem('sysacad_google_user', JSON.stringify(userObj));
          resolve({ user: userObj, accessToken });
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
}

export const googleSignIn = async (): Promise<{ user: User | GoogleAuthUser; accessToken: string } | null> => {
  isSigningIn = true;
  const effectiveClientId = getEffectiveClientId();

  // 1. If GIS (Google Identity Services) is available on the window, try it first
  const google = (window as any).google;
  if (google?.accounts?.oauth2 && effectiveClientId) {
    try {
      const gisResult = await signInWithGISToken();
      isSigningIn = false;
      return gisResult;
    } catch (gisErr: any) {
      console.warn('GIS sign in error:', gisErr);
      isSigningIn = false;
      throw gisErr;
    }
  }

  // 2. Fallback to Firebase Auth signInWithPopup
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener token de acceso de Google.');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('sysacad_google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Auth sign in error:', error);
    
    // If Firebase Auth throws unauthorized-domain and GIS is available, retry with GIS
    if (error?.code === 'auth/unauthorized-domain' && google?.accounts?.oauth2 && effectiveClientId) {
      try {
        const gisResult = await signInWithGISToken();
        return gisResult;
      } catch (retryErr) {
        throw retryErr;
      }
    }
    
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('sysacad_google_access_token');
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    console.warn('Firebase signout error:', e);
  }
  cachedAccessToken = null;
  localStorage.removeItem('sysacad_google_access_token');
  localStorage.removeItem('sysacad_google_user');
};
