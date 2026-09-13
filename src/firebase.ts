import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, getDoc, getDocFromServer } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyAmj6yWjW_kXz4FIWrPIURilJXNKr6vD6Q",
  authDomain: "gen-lang-client-0229307036.firebaseapp.com",
  projectId: "gen-lang-client-0229307036",
  firestoreDatabaseId: "ai-studio-sysacad-9cd87d45-b9dd-4fb3-a65b-6576cad071af",
  storageBucket: "gen-lang-client-0229307036.firebasestorage.app",
  messagingSenderId: "61319267735",
  appId: "1:61319267735:web:853cf76b4a9255a9f4b0d2"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection on boot as mandated by security and reliability guidelines
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_stores', 'main'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline, check connection.");
    } else {
      console.warn("Firestore connection check note:", error);
    }
    return false;
  }
}

// Subscribe to real-time updates of the school system store
export function subscribeToFirebaseStore(onUpdate: (data: Record<string, any>) => void): () => void {
  try {
    const unsub = onSnapshot(doc(db, 'system_stores', 'main'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data) {
          onUpdate(data);
        }
      }
    }, (error) => {
      console.warn("Realtime Firestore subscription warning:", error);
    });
    return unsub;
  } catch (err) {
    console.warn("Failed to attach Firestore snapshot listener:", err);
    return () => {};
  }
}

// Save or merge updates directly to Firestore
export async function saveToFirebaseStore(data: Record<string, any>): Promise<void> {
  try {
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    }
    cleanData.updatedAt = new Date().toISOString();
    await setDoc(doc(db, 'system_stores', 'main'), cleanData, { merge: true });
  } catch (err) {
    console.warn("Failed to persist to Firestore:", err);
  }
}

// One-time load from Firestore
export async function loadFromFirebaseStore(): Promise<Record<string, any> | null> {
  try {
    const snap = await getDoc(doc(db, 'system_stores', 'main'));
    if (snap.exists()) {
      return snap.data() as Record<string, any>;
    }
  } catch (err) {
    console.warn("Failed to fetch from Firestore:", err);
  }
  return null;
}
