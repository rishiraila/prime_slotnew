// src/lib/firebaseClient.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'your_key_here',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your_auth_domain',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your_project_id',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'your_app_id',
  // optional:
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

// Initialize app only on client
export function initFirebaseClient() {
  if (typeof window === 'undefined') return null;
  if (!getApps().length) {
    initializeApp(firebaseConfig);
    // console.log('Firebase client app initialized');
  }
  return getAuth();
}
