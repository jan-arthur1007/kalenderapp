import Constants from 'expo-constants';
import { auth } from '../database/firebase';

const CREATE_EVENT_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_CREATE_EVENT_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_CREATE_EVENT_URL ||
  process.env.EXPO_PUBLIC_CREATE_EVENT_URL ||
  '';

const DELETE_EVENT_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_DELETE_EVENT_URL ||
  Constants.manifest?.extra?.EXPO_PUBLIC_DELETE_EVENT_URL ||
  process.env.EXPO_PUBLIC_DELETE_EVENT_URL ||
  '';

export async function createCalendarEvent(payload) {
  if (!CREATE_EVENT_URL) {
    throw new Error('Mangler EXPO_PUBLIC_CREATE_EVENT_URL i app-konfigurasjonen.');
  }
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Du må være innlogget.');
  }
  const idToken = await current.getIdToken();

  const response = await fetch(CREATE_EVENT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || json.message || 'Kunne ikke opprette kalenderhendelse.');
  }
  return json;
}

export async function deleteCalendarEvent(payload) {
  if (!DELETE_EVENT_URL) {
    throw new Error('Mangler EXPO_PUBLIC_DELETE_EVENT_URL i app-konfigurasjonen.');
  }
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Du må være innlogget.');
  }
  const idToken = await current.getIdToken();

  const response = await fetch(DELETE_EVENT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, ownerUid: current.uid }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || json.message || 'Kunne ikke slette kalenderhendelse.');
  }
  return json;
}
