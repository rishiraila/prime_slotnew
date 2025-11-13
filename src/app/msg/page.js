// src/app/msg/page.js
"use client";

import { useEffect, useState } from "react";

export default function MsgOtpPage() {
  const [loaded, setLoaded] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState(null);
  const [reqId, setReqId] = useState(null);

  // ---------- Replace these with your MSG91 widget values ----------
  const WIDGET_ID = "356b67656c53363533323930";
  const TOKEN_AUTH = "417046TmuGjcKYAXo6915aa30P1";
  // ------------------------------------------------------------------

  useEffect(() => {
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
        exposeMethods: true,
        // For local dev keep empty. For prod set a valid DOM id or enable/disable captcha in widget settings.
        captchaRenderId: "",
        success: (data) => {
          try {
            console.log("MSG91 global success:", data);
          } catch (e) {
            console.error("success callback error:", e);
          }
        },
        failure: (err) => {
          try {
            console.error("MSG91 global failure:", err);
          } catch (e) {
            console.error("failure callback error:", e);
          }
        },
      };

      if (typeof window.initSendOTP === "function") {
        try {
          window.initSendOTP(configuration);
          setLoaded(true);
          console.info("MSG91 initSendOTP completed.");
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
    if (!identifier) return setStatus({ ok: false, message: "Enter phone (country code + number, e.g. 9199...)" });
    if (!loaded || typeof window.sendOtp !== "function") {
      return setStatus({ ok: false, message: "Widget not ready. Wait a moment." });
    }

    setReqId(null);
    setOtp("");

    try {
      window.sendOtp(
        identifier,
        (data) => {
          try {
            console.log("sendOtp success:", data);
            setStatus({ ok: true, message: "OTP sent. Check device." });
            // store possible reqId
            const id = data?.reqId || data?.request_id || data?.requestId || data?.req_id;
            if (id) setReqId(id);
          } catch (inner) {
            console.error("sendOtp success handler error:", inner);
            setStatus({ ok: false, message: "sendOtp success handling error" });
          }
        },
        (err) => {
          try {
            console.error("sendOtp error:", err);
            setStatus({ ok: false, message: err?.message || JSON.stringify(err) });
          } catch (inner) {
            console.error("sendOtp error handler threw:", inner);
            setStatus({ ok: false, message: "sendOtp failed" });
          }
        }
      );
    } catch (outer) {
      console.error("window.sendOtp threw:", outer);
      setStatus({ ok: false, message: "Failed to call sendOtp" });
    }
  }

  function handleRetry() {
    if (!loaded || typeof window.retryOtp !== "function") {
      return setStatus({ ok: false, message: "retryOtp not available" });
    }
    try {
      window.retryOtp(
        null,
        (data) => {
          try {
            console.log("retryOtp success:", data);
            setStatus({ ok: true, message: "OTP resent" });
            const id = data?.reqId || data?.request_id || data?.requestId;
            if (id) setReqId(id);
          } catch (inner) {
            console.error("retryOtp success handler error:", inner);
            setStatus({ ok: false, message: "retry handling error" });
          }
        },
        (err) => {
          try {
            console.error("retryOtp error:", err);
            setStatus({ ok: false, message: err?.message || JSON.stringify(err) });
          } catch (inner) {
            console.error("retryOtp failure handler error:", inner);
            setStatus({ ok: false, message: "retry failed" });
          }
        },
        reqId || null
      );
    } catch (outer) {
      console.error("window.retryOtp threw:", outer);
      setStatus({ ok: false, message: "Failed to call retryOtp" });
    }
  }

  function handleVerify() {
    setStatus(null);
    if (!loaded || typeof window.verifyOtp !== "function") {
      return setStatus({ ok: false, message: "verifyOtp not available" });
    }
    if (!otp) return setStatus({ ok: false, message: "Enter OTP" });

    try {
      window.verifyOtp(
        otp,
        (data) => {
          try {
            console.log("verifyOtp success:", data);
            // Token can be inside data.message per MSG91 SDK
            const accessToken =
              data?.["access-token"] ||
              data?.access_token ||
              data?.token ||
              data?.accessToken ||
              data?.message;

            if (!accessToken) {
              setStatus({ ok: false, message: "No access token returned. Inspect console.", raw: data });
              return;
            }

            verifyOnServer(accessToken);
          } catch (inner) {
            console.error("verifyOtp success handler error:", inner);
            setStatus({ ok: false, message: "Error handling verification response" });
          }
        },
        (err) => {
          try {
            console.error("verifyOtp failure:", err);
            setStatus({ ok: false, message: err?.message || JSON.stringify(err) });
          } catch (inner) {
            console.error("verify failure handler error:", inner);
            setStatus({ ok: false, message: "Verification failed" });
          }
        },
        reqId || null
      );
    } catch (outer) {
      console.error("window.verifyOtp threw:", outer);
      setStatus({ ok: false, message: "Failed to call verifyOtp" });
    }
  }

  async function verifyOnServer(accessToken) {
    setStatus({ ok: null, message: "Verifying on server..." });
    try {
      const res = await fetch("/api/verifyotp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setStatus({ ok: true, message: "OTP verified — login success", data: json.data ?? json });
        // TODO: set session cookie or redirect user here
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
    <div style={{ padding: 18, maxWidth: 640 }}>
      <h2>Login with OTP (MSG91 widget)</h2>

      <div style={{ marginBottom: 8 }}>
        <label>Mobile number (with country code, e.g. 9199...)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9199XXXXXXXX" style={{ width: "100%", padding: 8, marginTop: 6 }} />
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
