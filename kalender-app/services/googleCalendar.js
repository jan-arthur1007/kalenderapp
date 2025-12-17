
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { get, ref } from 'firebase/database';
import { database } from '../database/firebase';

// Backend-endepunkt (Cloud Function) som starter OAuth-flowen
const AUTH_START_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_AUTH_START_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_GOOGLE_AUTH_START_URL ||
  process.env.EXPO_PUBLIC_GOOGLE_AUTH_START_URL ||
  '';

// Sjekk om vi har konfigurert auth-start-url
export const hasGoogleClientId = () => !!AUTH_START_URL;

// Poller Realtime DB for tokens etter at brukeren har vært innom authStart
async function waitForToken(uid, attempts = 10, delayMs = 1500) {
  for (let i = 0; i < attempts; i += 1) {
    const snapshot = await get(ref(database, `calendarTokens/${uid}`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

// Starter OAuth i ekstern nettleser og henter token via DB
export async function linkGoogleCalendar(user) {
  if (!AUTH_START_URL) {
    throw new Error('Mangler AUTH_START_URL (EXPO_PUBLIC_GOOGLE_AUTH_START_URL).');
  }
  if (!user?.uid) {
    throw new Error('Ingen bruker tilgjengelig for kalenderkobling.');
  }

  const startUrl = `${AUTH_START_URL}?uid=${encodeURIComponent(user.uid)}`;
  // Resultatet fra WebBrowser kan være "dismiss"; vi poller DB etterpå uansett
  await WebBrowser.openBrowserAsync(startUrl);

  const tokenData = await waitForToken(user.uid);
  if (!tokenData) {
    throw new Error('Fant ingen Google-data etter autentisering. Forsøk på nytt.');
  }
  return tokenData;
}

// Viser melding hvis authStart ikke er konfigurert
export function promptMissingClientId() {
  Alert.alert(
    'Google-konfigurasjon mangler',
    'Sett EXPO_PUBLIC_GOOGLE_AUTH_START_URL i app-konfigurasjonen og start Expo på nytt for å aktivere kalenderkobling.'
  );
}

// Trygg wrapper som viser alert ved suksess/feil
export async function safeLinkGoogleCalendar(user) {
  try {
    const tokens = await linkGoogleCalendar(user);
    Alert.alert(
      'Google-kalender tilkoblet',
      'Vi har nå lagret tilgang til Google-kalenderen din.'
    );
    return tokens;
  } catch (err) {
    Alert.alert(
      'Feil',
      err.message || 'Klarte ikke å koble til Google-kalenderen. Prøv igjen.'
    );
    throw err;
  }
}
