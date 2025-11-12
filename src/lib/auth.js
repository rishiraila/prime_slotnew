import { adminAuth } from './firebaseAdmin';

export async function verifyAuth(request) {
  const token = request.headers.get('authorization')?.split('Bearer ')[1];

  if (!token) {
    return null;
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch (error) {
    return null;
  }
}