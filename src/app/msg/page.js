// src/app/msg/page.js
"use client";

import { useEffect, useState } from "react";

export default function MsgOtpPage() {
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState(null);
  const [reqId, setReqId] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  // Replace with your real values from MSG91 dashboard
  const WIDGET_ID = "356b67656c53363533323930";
  const TOKEN_AUTH = "417046TmuGjcKYAXo6915aa30P1";

  useEffect(() => {
    // load script only once
    if (window.MSG91_OTP_LOADED) {
      setLoaded(true);
      return;
    }

    const s = document.createElement("script");
    s.src = "https://verify.msg91.com/otp-provider.js";
    s.async = true;
    s.onload = () => {
      window.MSG91_OTP_LOADED = true;

      const configuration = {
        widgetId: WIDGET_ID,
        tokenAuth: TOKEN_AUTH,
        identifier: "",
        exposeMethods: true,     // IMPORTANT for web custom UI
        captchaRenderId: "",     // keep empty for local dev (prevents hCaptcha localhost warning)
        success: (data) => {
          // Global success callback (optional)
          console.log("MSG91 global success:", data);
        },
        failure: (err) => {
          console.error("MSG91 global failure:", err);
        },
      };

      if (typeof window.initSendOTP === "function") {
        try {
          window.initSendOTP(configuration);
          setLoaded(true);
        } catch (e) {
          console.error("initSendOTP error:", e);
          setStatus({ ok: false, message: "Widget init error: " + String(e) });
        }
      } else {
        console.error("initSendOTP not found after script load");
        setStatus({ ok: false, message: "Widget script loaded but initSendOTP missing" });
      }
    };
    s.onerror = (e) => {
      console.error("Failed to load MSG91 script", e);
      setStatus({ ok: false, message: "Failed to load MSG91 script" });
    };

    document.body.appendChild(s);
  }, []);

  function handleSendOtp() {
    setStatus(null);
    const identifier = phone.trim();
    if (!identifier) return setStatus({ ok: false, message: "Enter phone (91XXXXXXXXXX)" });
    if (!loaded || typeof window.sendOtp !== "function") {
      return setStatus({ ok: false, message: "Widget not ready. Wait a moment." });
    }

    setReqId(null);
    setOtp("");
    setIsDemo(false);

    window.sendOtp(
      identifier,
      (data) => {
        // MSG91 will return data containing reqId or demo info depending on widget config
        console.log("sendOtp success:", data);
        setStatus({ ok: true, message: "OTP sent. Check your device." });

        // store request id if present for retry/verify
        const id = data?.reqId || data?.request_id || data?.requestId || data?.req_id;
        if (id) setReqId(id);

        // detect demo behavior; MSG91 might return that this is demo and what OTP/pin is
        if (data?.isDemo || data?.demo || (data?.demo_pin || data?.otp_pin)) {
          setIsDemo(true);
          setStatus((s) => ({ ...(s || {}), demo: data }));
        }
      },
      (err) => {
        console.error("sendOtp error:", err);
        setStatus({ ok: false, message: err?.message || JSON.stringify(err) });
      }
    );
  }

  function handleRetry() {
    if (!loaded || typeof window.retryOtp !== "function") {
      return setStatus({ ok: false, message: "retryOtp not available" });
    }
    window.retryOtp(
      null, // default channel (server decides)
      (data) => {
        console.log("retryOtp success", data);
        setStatus({ ok: true, message: "OTP resent" });
        const id = data?.reqId || data?.request_id || data?.requestId;
        if (id) setReqId(id);
      },
      (err) => {
        console.error("retryOtp error", err);
        setStatus({ ok: false, message: err?.message || JSON.stringify(err) });
      },
      reqId || null
    );
  }

  function handleVerify() {
    setStatus(null);
    if (!loaded || typeof window.verifyOtp !== "function") {
      return setStatus({ ok: false, message: "verifyOtp not available" });
    }
    if (!otp) return setStatus({ ok: false, message: "Enter OTP" });

    window.verifyOtp(
      otp,
      (data) => {
        console.log("verifyOtp success:", data);
        // extract access token
        const accessToken = data?.["access-token"] || data?.access_token || data?.token || data?.accessToken;
        if (!accessToken) {
          setStatus({ ok: false, message: "No access token returned. Inspect console." });
          return;
        }
        // send access token to server for final validation
        verifyOnServer(accessToken);
      },
      (err) => {
        console.error("verifyOtp failure:", err);
        setStatus({ ok: false, message: err?.message || JSON.stringify(err) });
      },
      reqId || null
    );
  }

  async function verifyOnServer(accessToken) {
    setStatus({ ok: null, message: "Verifying on server..." });
    try {
      const res = await fetch("/api/verfiyotp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatus({ ok: true, message: "OTP verified — login success", data: json.data ?? json });
        // TODO: create session / set cookie / redirect user
      } else {
        console.warn("Server verify failed:", json);
        setStatus({ ok: false, message: json.message || "Server verification failed", raw: json });
      }
    } catch (e) {
      console.error("verifyOnServer error:", e);
      setStatus({ ok: false, message: "Server verify request failed: " + String(e) });
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 560 }}>
      <h2>Login with OTP (MSG91 widget)</h2>

      <div style={{ marginBottom: 8 }}>
        <label>Mobile number (with country code, e.g. 91XXXXXXXXXX)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="91XXXXXXXXXX" style={{ width: "100%", padding: 8, marginTop: 6 }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSendOtp} disabled={!loaded} style={{ padding: "8px 12px" }}>Send OTP</button>
        <button onClick={handleRetry} disabled={!loaded || !reqId} style={{ padding: "8px 12px" }}>Resend</button>
      </div>

      <div style={{ marginTop: 14 }}>
        <label>Enter OTP</label>
        <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter received OTP" style={{ width: "100%", padding: 8, marginTop: 6 }} />
        <button onClick={handleVerify} style={{ marginTop: 8, padding: "8px 12px" }}>Verify OTP</button>
      </div>

      <div style={{ marginTop: 18 }}>
        <strong>Widget loaded:</strong> {loaded ? "Yes" : "No"}
      </div>

      <div style={{ marginTop: 12, background: "#f6f8fa", padding: 12, borderRadius: 6 }}>
        <pre style={{ margin: 0 }}>{status ? JSON.stringify(status, null, 2) : "No activity yet"}</pre>
      </div>
    </div>
  );
}
