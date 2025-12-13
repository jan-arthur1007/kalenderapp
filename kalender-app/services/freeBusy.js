import Constants from 'expo-constants';
import { auth } from '../database/firebase';

const GROUP_FUNCTION_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GROUP_FREE_BUSY_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_GROUP_FREE_BUSY_URL ||
  process.env.EXPO_PUBLIC_GROUP_FREE_BUSY_URL ||
  '';

export async function requestFreeBusy(accessToken, { timeMin, timeMax }) {
  if (!accessToken) {
    throw new Error('Mangler accessToken for Google-kalender.');
  }

  const body = {
    timeMin,
    timeMax,
    items: [{ id: 'primary' }],
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'Kunne ikke hente ledige tider.');
  }

  return response.json();
}

export async function fetchGroupFreeBusy(groupId, { timeMin, timeMax } = {}) {
  if (!GROUP_FUNCTION_URL) {
    throw new Error('Mangler EXPO_PUBLIC_GROUP_FREE_BUSY_URL i app-konfigurasjonen.');
  }
  if (!groupId) {
    throw new Error('Velg en gruppe for å hente forslag.');
  }
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Du må være innlogget.');
  }
  const idToken = await current.getIdToken();
  const params = new URLSearchParams({ groupId });
  if (timeMin) params.append('timeMin', timeMin);
  if (timeMax) params.append('timeMax', timeMax);

  const response = await fetch(`${GROUP_FUNCTION_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Kunne ikke hente gruppens ledige tider.');
  }
  return payload;
}
