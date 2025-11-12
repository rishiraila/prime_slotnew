import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDqR1GfS9Wshql-msxrsDAb0ljAaRgMMt4",
  authDomain: "prime-slot-51dbf.firebaseapp.com",
  databaseURL: "https://prime-slot-51dbf-default-rtdb.firebaseio.com",
  projectId: "prime-slot-51dbf",
  storageBucket: "prime-slot-51dbf.appspot.com", // ✅ fixed
  messagingSenderId: "603430678615",
  appId: "1:603430678615:web:3de4862675083f4a82f312",
  measurementId: "G-CFE2RGBXVT",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Optional: Analytics (browser-only)
export let analytics = null;
if (typeof window !== "undefined") {
  analyticsIsSupported()
    .then((ok) => { if (ok) analytics = getAnalytics(app); })
    .catch(() => {});
}
