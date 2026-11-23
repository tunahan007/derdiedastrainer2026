// Zentrale Werbe-Initialisierung: DSGVO-Einwilligung (UMP) -> ATT (iOS) -> AdMob-Start.
// Banner fragen über useAdsReady() ab, ob Anzeigen geladen werden dürfen.
import { useEffect, useState } from "react";
import { Platform, AppState } from "react-native";
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
} from "react-native-google-mobile-ads";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";

let adsReady = false;
let initPromise = null;
const listeners = new Set();

function setAdsReady(value) {
  adsReady = value;
  listeners.forEach((fn) => fn(value));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

async function waitUntilActive() {
  if (AppState.currentState === "active") return;
  await new Promise((resolve) => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sub.remove();
        resolve();
      }
    });
  });
}

// iOS: ATT-Abfrage (nur falls noch nicht entschieden – z. B. wenn der
// IDFA-Explainer aus AdMob sie nicht schon angezeigt hat).
async function requestTrackingIfNeeded() {
  if (Platform.OS !== "ios") return;
  try {
    const { status } = await getTrackingPermissionsAsync();
    if (status !== "undetermined") return;
    await waitUntilActive();
    await new Promise((r) => setTimeout(r, 500));
    const result = await requestTrackingPermissionsAsync();
    console.log("🔒 ATT status:", result.status);
  } catch (e) {
    console.warn("ATT error:", e);
  }
}

async function runInit() {
  // 1) DSGVO-/UMP-Einwilligung einholen (Formular erscheint nur wenn nötig, z. B. EU/UK)
  try {
    await waitUntilActive();
    await withTimeout(AdsConsent.gatherConsent(), 15000);
  } catch (e) {
    console.warn("Consent error:", e?.message || e);
  }

  // 2) iOS ATT
  await requestTrackingIfNeeded();

  // 3) Nur starten, wenn Anzeigen angefragt werden dürfen
  let canRequestAds = false;
  try {
    const info = await AdsConsent.getConsentInfo();
    canRequestAds = !!info.canRequestAds;
  } catch (e) {
    console.warn("Consent info error:", e?.message || e);
  }

  if (canRequestAds) {
    try {
      await mobileAds().initialize();
    } catch (e) {
      console.warn("MobileAds init error:", e?.message || e);
    }
  }
  console.log("📢 Ads ready:", canRequestAds);
  setAdsReady(canRequestAds);
  return canRequestAds;
}

export function initAds() {
  if (!initPromise) initPromise = runInit();
  return initPromise;
}

export function useAdsReady() {
  const [ready, setReady] = useState(adsReady);
  useEffect(() => {
    listeners.add(setReady);
    setReady(adsReady);
    return () => listeners.delete(setReady);
  }, []);
  return ready;
}

// Muss Nutzern in der EU/UK angeboten werden, damit sie ihre Wahl ändern können
export async function isPrivacyOptionsRequired() {
  try {
    const info = await AdsConsent.getConsentInfo();
    return (
      info.privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
    );
  } catch {
    return false;
  }
}

export async function showPrivacyOptions() {
  try {
    await AdsConsent.showPrivacyOptionsForm();
    const info = await AdsConsent.getConsentInfo();
    if (info.canRequestAds && !adsReady) {
      await mobileAds().initialize();
    }
    setAdsReady(!!info.canRequestAds);
  } catch (e) {
    console.warn("Privacy options error:", e?.message || e);
  }
}
