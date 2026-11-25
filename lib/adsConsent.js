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
// Aktueller Init-Schritt – wird bei einem Start-Timeout geloggt (Diagnose)
let initStep = "not started";
export const getInitStep = () => initStep;
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

// Wartet, bis die App aktiv ist – höchstens maxMs (sonst hängt der Start,
// falls das "active"-Event nie kommt).
async function waitUntilActive(maxMs = 3000) {
  if (AppState.currentState === "active") return;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      sub.remove();
      clearTimeout(timer);
      resolve();
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") finish();
    });
    const timer = setTimeout(finish, maxMs);
  });
}

// iOS: ATT-Abfrage (nur falls noch nicht entschieden – z. B. wenn der
// IDFA-Explainer aus AdMob sie nicht schon angezeigt hat).
async function requestTrackingIfNeeded() {
  if (Platform.OS !== "ios") return;
  try {
    initStep = "ATT status";
    const { status } = await withTimeout(getTrackingPermissionsAsync(), 5000);
    if (status !== "undetermined") return;
    await waitUntilActive();
    await new Promise((r) => setTimeout(r, 500));
    initStep = "ATT prompt";
    // Nutzer darf sich Zeit lassen, aber nie unbegrenzt
    const result = await withTimeout(requestTrackingPermissionsAsync(), 60000);
    console.log("🔒 ATT status:", result.status);
  } catch (e) {
    console.warn("ATT error:", e);
  }
}

async function runInit() {
  // 1) DSGVO-/UMP-Einwilligung einholen (Formular erscheint nur wenn nötig, z. B. EU/UK)
  try {
    initStep = "wait active";
    await waitUntilActive();
    initStep = "UMP consent";
    await withTimeout(AdsConsent.gatherConsent(), 15000);
  } catch (e) {
    console.warn("Consent error:", e?.message || e);
  }

  // 2) iOS ATT
  await requestTrackingIfNeeded();

  // 3) Nur starten, wenn Anzeigen angefragt werden dürfen
  let canRequestAds = false;
  try {
    initStep = "consent info";
    const info = await withTimeout(AdsConsent.getConsentInfo(), 5000);
    canRequestAds = !!info.canRequestAds;
  } catch (e) {
    console.warn("Consent info error:", e?.message || e);
  }

  if (canRequestAds) {
    try {
      initStep = "mobileAds initialize";
      await withTimeout(mobileAds().initialize(), 10000);
    } catch (e) {
      console.warn("MobileAds init error:", e?.message || e);
    }
  }
  initStep = "done";
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
