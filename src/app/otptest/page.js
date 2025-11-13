'use client';

import { useEffect, useState } from 'react';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export default function OtpTestPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // ✅ OPTIONAL: disable app verification for local testing only
    // auth.settings.appVerificationDisabledForTesting = true;

    // ✅ Setup visible reCAPTCHA
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      'recaptcha-container',
      {
        size: 'normal',
        callback: (response) => {
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired, try again.');
        },
      }
    );

    window.recaptchaVerifier.render();
  }, []);

  const sendOtp = async (e) => {
    e.preventDefault();
    const auth = getAuth();
    const appVerifier = window.recaptchaVerifier;

    try {
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
      setMessage('OTP sent! Check your phone.');
    } catch (err) {
      console.error(err);
      setMessage('Error sending OTP: ' + err.message);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    try {
      const result = await confirmationResult.confirm(otp);
      setMessage('✅ Login successful for ' + result.user.phoneNumber);
    } catch (err) {
      console.error(err);
      setMessage('❌ Invalid OTP: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="p-4 border rounded w-80">
        <h2 className="text-xl font-bold mb-4">Firebase OTP Login</h2>
        <div id="recaptcha-container" className="mb-3"></div>

        {!confirmationResult ? (
          <form onSubmit={sendOtp}>
            <input
              type="tel"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border p-2 w-full mb-2 text-black"
              required
            />
            <button
              type="submit"
              className="bg-blue-500 text-white w-full p-2 rounded"
            >
              Send OTP
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="border p-2 w-full mb-2 text-black"
              required
            />
            <button
              type="submit"
              className="bg-green-500 text-white w-full p-2 rounded"
            >
              Verify OTP
            </button>
          </form>
        )}

        {message && <p className="mt-3 text-center text-sm">{message}</p>}
      </div>
    </div>
  );
}
