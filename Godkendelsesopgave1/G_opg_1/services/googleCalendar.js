
/*
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { ref, set } from 'firebase/database';
import { database } from '../database/firebase';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_ENDPOINT = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

const resolveClientId = () => {
  const candidates = [
    Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    Constants.expoConfig?.expoClient?.extra?.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    Constants.manifest?.extra?.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    Constants.manifest?.extra?.expoClient?.extra?.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length) {
      return value.trim();
    }
  }
  return '';
};

const CLIENT_ID = resolveClientId();
export const hasGoogleClientId = () => !!CLIENT_ID;

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = await response.json();
  if (!response.ok || json.error) {
    const message = json.error_description || json.error || 'Kunne ikke hente Google-tilgang.';
    throw new Error(message);
  }
  return json;
}

async function fetchCalendarList(accessToken) {
  const response = await fetch(CALENDAR_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    const message = json.error?.message || 'Kunne ikke hente Google-kalendere.';
    throw new Error(message);
  }
  return json.items || [];
}

export async function linkGoogleCalendar(user) {
  if (!CLIENT_ID) {
    throw new Error('Mangler Google Client ID (EXPO_PUBLIC_GOOGLE_CLIENT_ID).');
  }
  if (!user?.uid) {
    throw new Error('Ingen bruker tilgjengelig for kalenderkobling.');
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'gopg1',
    path: 'oauth',
    useProxy: false,
  });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DEFAULT_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Autentiseringen ble avbrutt før Google ga en kode.');
  }

  const parsed = Linking.parse(result.url);
  const code = parsed?.queryParams?.code;
  if (!code) {
    throw new Error('Fikk ingen autorisasjonskode fra Google.');
  }

  const tokenData = await exchangeCode(code, redirectUri);
  const calendars = await fetchCalendarList(tokenData.access_token);

  if (!calendars.length) {
    throw new Error('Fant ingen Google-kalendere for denne kontoen.');
  }

  await set(ref(database, `calendarTokens/${user.uid}`), {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    grantedScopes: tokenData.scope,
    updatedAt: Date.now(),
  });

  return calendars;
}

export function promptMissingClientId() {
  Alert.alert(
    'Google-konfigurasjon mangler',
    'Sett EXPO_PUBLIC_GOOGLE_CLIENT_ID i app-konfigurasjonen og start Expo på nytt for å aktivere kalenderkobling.'
  );
}
*/

