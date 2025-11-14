import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

// ------------------------------
// Initialize Firebase Admin App
// ------------------------------
const app =
  getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: "prime-slot-51dbf",
          clientEmail: "firebase-adminsdk-fbsvc@prime-slot-51dbf.iam.gserviceaccount.com",
          privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCkj/Ib7pjwUDBT\nMzyYJtRwY9LuVmVnuXE/m1kip0yqSrXRhB67btjqbSqX2l2u+k1XVxFOY877JIqS\n7dcQFVRFbzHcB7HzCnkrh1dEceGLjwakHHrhOFO+pTrC803267XHxH7K+Ft4vGNe\nDECdS3l4y9mmTII/MhdH6W4E4ePrBgZxT/PNc5wupoCsS9F/bZErAVSMELoX/hsw\nTMSp8+AGxu1yoBCLH+hG1j61IqgH6S+k1FQVt3JgjzlSj3iGocaa5JtZTF6JLutD\npiV3hB1vT4EBldyTHKxEqBbrGjBuitR5FkIUPRoOzTlofMi5MyZARzxO9SUfFH5h\nExeSnyARAgMBAAECggEADLY73xF+ye1/1iV6lExHk8j6RcPxwGHwUBgJeiZPQ0ZT\nJjSdBSCKbA1zwVgybW5TZCBLK3GFTxwjAjeSKeFj6Zst0E/d3Kbd9lFVmelsIVIy\nkqHKkjQ+L9dmoyGVT7IkkCJrIvWtZzWyPVUX9q6aWwzwKqr1UrllV/49q+3hI8nq\n/VI9Tr5Y8JpH+BxHDA4zGFyzr1mfKUB+dg0dC+TixV4VQ74wmeUpOY9uyjVwfkR3\n6nE6g4rzHad0hmjWXIhZNj9Ya7LPQUZv6y1QlSGH3w37+xM8XoaLoGUDwpxDuBGf\nObVz7SmTEbTKKqWi+FX/tWNom60XwEIZ5fapIgaV0wKBgQDjCMOt4Um9IuPZTsP0\nwSpODz9pJx6dXjnGtjKS28T48f3aTCMgNm/Hp/vvBSYG3kCaK1Y8QIjRJEN/rpsg\nctHUYWuTVQfN10NdOU2Z9GPgWfyvR1if9TlZzDi7+h+J84U1JlVMBz9ex+ykhwFU\njSNymfspUpH9Q5s+EAPYz9vkcwKBgQC5jsQEigDgcGeTzRIuzE7imLIdWk+cl81/\nTkGU/nQlpWrCTRLa77DN1GVuYACJ0K+t7b2ovyLqU4C8jhDGWOcYC2CSv1uAB1HR\nkW0c7EayBGp1PF1gIKK2xmDVnNuvpEsc8UZto1RXuEH03KM+rDO0L68pgnU8xlGF\nsUmLienMawKBgFouMQvwYQnvwfGfh9bAo7098UIjd9Wqh+iWlqAfC66W8O61L36s\nINp9r2TR9rjjr2WNsUNdnvr0HJurD5NkCFUEHWb4b5Ej4G43RMvSd5m2JNi6zkk7\nbvxsUlzYjY6OXGswPtFkT5emcikoNy8OoPX0k/9l/PdM021jjyOf7QhhAoGAZeQ6\nSM/K6XNvvN5H1MDFtHHqpGmZ+7/zzKsZIgqTlrR9qhIOf4BM0smFpRU8VnDsdxJs\nKcRDFO8jauaL2Y6p3y8oKYzAXs4mJHC5vL8Vlt0L5DJwh7+D+d92/vVyQMFzqYHn\njX65aq24MhAR5/FBNvlUMvP7EpNH4qTWYLQrWN8CgYEAsbrHx4TSuVLh7qdZk2m5\nJ40zCVFybVaL9mio1CuE9ya7EXrEhQVxudylfiBiUNB6Xh5GzPqzrnRnOte5WKWI\nX/cSGwN/bTh++QWdqouK6lNgWG1yeXbQGZZE8EdLKlT1LaCV9ApzjWPQBqn2W/O+\ng5qYtWxtJnKI9NeDDCHEcvc=\n-----END PRIVATE KEY-----\n"?.replace(/\\n/g, '\n'),
        }),
        databaseURL: "https://prime-slot-51dbf-default-rtdb.firebaseio.com",
        storageBucket: "prime-slot-51dbf.appspot.com",
      });

// ------------------------------
// Exports
// ------------------------------
export const adminAuth = getAdminAuth(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app); // <-- FIXED: now app exists

export function getAdminApp() {
  return { adminApp: app, adminAuth, rtdb, storage };
}
