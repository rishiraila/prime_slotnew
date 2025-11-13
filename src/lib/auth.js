// src/lib/verifyAuth.js (server)
import { adminAuth } from './firebaseAdmin'; // server-only

export async function verifyAuth(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) return null;

  try {
    return await adminAuth.verifyIdToken(token);
  } catch (error) {
    return null;
  }
}
