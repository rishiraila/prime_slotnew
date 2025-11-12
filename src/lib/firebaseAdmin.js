import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

const app =
  getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      })

export const adminAuth = getAdminAuth(app)
export const rtdb = getDatabase(app)

export function getAdminApp() {
  return { adminApp: app, adminAuth, rtdb }
}
