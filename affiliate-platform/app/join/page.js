"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const APP_STORE_URL =
  "https://apps.apple.com/id/app/dietku-hitung-kalori-harian/id6761396062";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=app.rork.dietku_clone_jlejfwy&hl=id";
const APP_SCHEME = "rork-app";
const ANDROID_PACKAGE = "app.rork.dietku_clone_jlejfwy";

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  return "other";
}

function buildAppDeepLink(code) {
  const query = code ? `?code=${encodeURIComponent(code)}` : "";
  return `${APP_SCHEME}://browse-groups${query}`;
}

function buildAndroidIntent(code) {
  const query = code ? `?code=${encodeURIComponent(code)}` : "";
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return (
    `intent://browse-groups${query}` +
    `#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

function storeUrlFor(platform) {
  if (platform === "ios") return APP_STORE_URL;
  if (platform === "android") return PLAY_STORE_URL;
  return null;
}

function JoinClient() {
  const searchParams = useSearchParams();
  const code = useMemo(
    () => normalizeCode(searchParams.get("code")),
    [searchParams]
  );
  const [platform, setPlatform] = useState("other");
  const [status, setStatus] = useState("opening");

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    const deepLink = buildAppDeepLink(code);
    const storeUrl = storeUrlFor(p);

    // Try opening DietKu first.
    if (p === "android") {
      window.location.href = buildAndroidIntent(code);
    } else if (p === "ios") {
      window.location.href = deepLink;
    } else {
      setStatus("ready");
      return;
    }

    // If the app isn't installed, browser stays on this page → send to store.
    const fallbackMs = p === "ios" ? 1600 : 1800;
    const timer = window.setTimeout(() => {
      if (document.hidden) {
        setStatus("opened");
        return;
      }
      setStatus("store");
      if (storeUrl) {
        window.location.href = storeUrl;
      }
    }, fallbackMs);

    const onVisibility = () => {
      if (document.hidden) {
        setStatus("opened");
        window.clearTimeout(timer);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code]);

  const deepLink = buildAppDeepLink(code);
  const storeUrl = storeUrlFor(platform) || APP_STORE_URL;

  return (
    <main className="join-page">
      <div className="join-card">
        <p className="join-brand">DietKu</p>
        <h1 className="join-title">Join group invite</h1>
        <p className="join-desc">
          {code
            ? "Opening DietKu so you can join this group."
            : "Open DietKu, or install it from the store if you do not have the app yet."}
        </p>

        {code ? (
          <div className="join-code-box" aria-label="Invite code">
            {code}
          </div>
        ) : null}

        <p className="join-status">
          {status === "opening" && "Trying to open the app…"}
          {status === "opened" && "App opened. You can close this tab."}
          {status === "store" && "App not found. Sending you to the store…"}
          {status === "ready" && "Install DietKu, then open this link again or enter the code in Community."}
        </p>

        <div className="join-actions">
          <a className="join-btn primary" href={deepLink}>
            Open DietKu
          </a>
          {platform === "ios" || platform === "other" ? (
            <a className="join-btn store" href={APP_STORE_URL}>
              Get on App Store
            </a>
          ) : null}
          {platform === "android" || platform === "other" ? (
            <a className="join-btn store" href={PLAY_STORE_URL}>
              Get on Play Store
            </a>
          ) : null}
          {platform !== "other" && storeUrl ? (
            <a className="join-btn ghost" href={storeUrl}>
              Don&apos;t have the app? Install
            </a>
          ) : null}
        </div>

        {code ? (
          <p className="join-hint">
            After installing, open DietKu → Community → Join with Code and enter{" "}
            <strong>{code}</strong>, or open this link again.
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="join-page">
          <div className="join-card">
            <p className="join-brand">DietKu</p>
            <h1 className="join-title">Join group invite</h1>
            <p className="join-desc">Loading invite…</p>
          </div>
        </main>
      }
    >
      <JoinClient />
    </Suspense>
  );
}
