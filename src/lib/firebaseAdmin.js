import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

// FULL service account from your JSON file
const serviceAccount = {
  type: 'service_account',
  project_id: 'prime-slot-35cd9',
  private_key_id: 'ef2f1a54338ac9a5d00116cf5090f518600a191b',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCnlW2Cv1x+kLF7
yQdf348dhdbwg+orYiMqYeEvzyKtFvZv5Ig09F34BXEWbhSQXdAZZpj7+MKP1pui
+vc6EmrG9RarVLOJEGKQzRNWuApVBbyidJBE8mNjn1XLX11xHsFqAoml+XatbVPj
zy1FgmyoGz2cWIL3icQCwcMxk1swF9NOrg+qS+YCN6ULzkWumZdkHniAxtJxivvA
aCY+Lfb7Y7rqLlmXkjugoJqwcB3CDbowaw0I9vHYgwHuNGuIJSTOlP82FER2e6fW
aUYO3tJdwiMVS3LUKjONXiGaqlCZ6QcG17XG7Hbe3ySO8qUGSXup91Ib6BKdRTXr
Cd4ilUhTAgMBAAECggEAANW7PnACn3TMFZBKU51zApQknn0hwQaTo0Xqj8jp5M/c
+XC7hvwCrdYlGpYAzzlQbJf4wiSan4nTq6uxaJ4n3wbgjoj0/gVRYGRNKNzw3DyT
lIGdKGLGwPvNux4mAobDMuqBUgzcnP+S7+sb0CFWtj2wgGNmf6I1kkfx14Di7unl
aL03+8V5BplXxI6o43Iy2RTI8kQ+vZcgti0NGwnk0tRD5IthDWZ4vb6PY+K8hqO3
h59wvj9/NQhm2FSbfeq9ldKb/6ILFQcL67EMTcNXAZ4gemQU7cJIPWd8s14kfH2z
sJBXwFTkEcMzt5A1dhOxDnS7mWeiz3zRkoVneSwBYQKBgQDRU60gcaj1uYiYoBCr
Na6m3VDfINpSbY3z92y0/7TDv0w6oaOc5WzqNWFKiMqBKf4Zx/sFIGVjAsOk8L3v
/mY2gDs4kr/dP/mLQu6N9rdKTbiFdfpIikk3fVKHGZivb5sNKQpqB3cTn58Rk5Lx
XPnZoNy0D/FFqWk31fm9qQgQswKBgQDM8xAMobyUfbY1qb1BAUc6y04qY01T2C75
bv/tDqU3X042VnEtxoNLwtPKHuw/YvIXUh1qjdHjGXwHWA+EJM9lCyjpVtmG6ZFx
Eb1ed06GIsA60Kqw4dLfTD2ztVUsoCj7nkQ6XI3FhywYp4k9Cs7wuB4aNudXov+e
8Wfyi/554QKBgQC04/SGRvJVdoF+M0R0T62f8T0DtOY1uQqkuzorp5VUWynKuQgk
e3aFZp+uw0sMF3fIW7KmmXpD942OKaRZkqRNkL6cguRek/xXxf1UnNGD2moMmwkw
SqA+3YPFz+7MHEwHMWIYgl76jEPv8nFXNpuK36IZ0HUVV/LfF3/7z+hyVQKBgAwT
Ac4MtUR2R4bP0jODNMQU+CztHsAiy1msnW1E4Jzrg3sWCqLswA11k+6jdb2iQar4
Dn2Zj1T2ymTQXlGlrYZBaw6cLEKTfhsQNXzcQIcMgxCz/GphU4AOSNBOjY8MfH2e
bFyX2U5a0VE+hYpQGbL61eMreuOh2bdud3ZFox9hAoGAeFX922Hw9iBYH4q+7yGw
Nhex71Y2yB1dESmiE0zY205gNNnk3rQ4UuB1yhRgKYv7OJW9QEtITCt4aKe+xLPn
3r3ORTZJQFIsfAv5q05cXC3HUsromOVUcl5+W/kgHm4oTzt041E3UjQWo74FfBs6
dUH8NtxpHPKBTFLOohlYv9A=
-----END PRIVATE KEY-----`,
  client_email: 'firebase-adminsdk-fbsvc@prime-slot-35cd9.iam.gserviceaccount.com',
  client_id: '101745594309426119785',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url:
    'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40prime-slot-35cd9.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
};

const app =
  getApps().length
    ? getApp()
    : initializeApp({
        credential: cert(serviceAccount),
        databaseURL: 'https://prime-slot-35cd9-default-rtdb.firebaseio.com',

        // ✅ use the actual bucket ID shown in Firebase console:
        // gs://prime-slot-35cd9.firebasestorage.app
        storageBucket: 'prime-slot-35cd9.firebasestorage.app',
      });

export const adminAuth = getAdminAuth(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

// Everyone uses SAME bucket
export const bucket = storage.bucket();

export function getAdminApp() {
  return { adminApp: app, adminAuth, rtdb, storage, bucket };
}
