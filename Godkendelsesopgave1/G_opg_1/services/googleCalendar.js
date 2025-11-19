
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { get, ref } from 'firebase/database';
import { database } from '../database/firebase';

const AUTH_START_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_AUTH_START_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_GOOGLE_AUTH_START_URL ||
  process.env.EXPO_PUBLIC_GOOGLE_AUTH_START_URL ||
  '';

export const hasGoogleClientId = () => !!AUTH_START_URL;

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

export async function linkGoogleCalendar(user) {
  if (!AUTH_START_URL) {
    throw new Error('Mangler AUTH_START_URL (EXPO_PUBLIC_GOOGLE_AUTH_START_URL).');
  }
  if (!user?.uid) {
    throw new Error('Ingen bruker tilgjengelig for kalenderkobling.');
  }

  const startUrl = `${AUTH_START_URL}?uid=${encodeURIComponent(user.uid)}`;
  const result = await WebBrowser.openBrowserAsync(startUrl);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Google-autentiseringen ble avbrutt før den var ferdig.');
  }

  const tokenData = await waitForToken(user.uid);
  if (!tokenData) {
    throw new Error('Fant ingen Google-data etter autentisering. Forsøk på nytt.');
  }
  return tokenData;
}

export function promptMissingClientId() {
  Alert.alert(
    'Google-konfigurasjon mangler',
    'Sett EXPO_PUBLIC_GOOGLE_AUTH_START_URL i app-konfigurasjonen og start Expo på nytt for å aktivere kalenderkobling.'
  );
}
