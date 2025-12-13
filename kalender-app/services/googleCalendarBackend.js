


// services/googleCalendarBackend.js
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ref, get } from 'firebase/database';
import { database } from '../database/firebase';

// 🔹 BASE-URL = Function URL til authStart (fra Firebase konsollen)
const AUTH_START_URL =
  'https://authstart-3fath7pjmq-uc.a.run.app/authStart';

// Brukes for å forlenge accessToken når det er utløpt (ikke i bruk nå – vi går via backend for refresh)

// Helper for å lese token etter at brukeren har vært i nettleseren
async function fetchCalendarTokens(uid) {
  const snapshot = await get(ref(database, `calendarTokens/${uid}`));
  if (!snapshot.exists()) {
    throw new Error('Fant ingen kalender-token i databasen etter innlogging.');
  }
  return snapshot.val();
}

/**
 * Starter Google OAuth i ekstern nettleser via backend (authStart),
 * og henter token fra Realtime DB når brukeren kommer tilbake.
 */
export async function linkGoogleCalendarViaBackend(user) {
  if (!user?.uid) {
    throw new Error('Ingen innlogget bruker – kan ikke koble kalender.');
  }

  const uid = user.uid;
  const url = `${AUTH_START_URL}?uid=${encodeURIComponent(uid)}`;

  const result = await WebBrowser.openBrowserAsync(url);

  // Når brukeren lukker nettleseren, prøver vi å hente token fra DB.
  try {
    const tokens = await fetchCalendarTokens(uid);
    return tokens;
  } catch (err) {
    console.log('Klarte ikke å hente calendarTokens etter auth:', err);
    throw err;
  }
}

/**
 * Enkel helper som viser en alert hvis noe går galt.
 */
export async function safeLinkGoogleCalendar(user) {
  try {
    const tokens = await linkGoogleCalendarViaBackend(user);
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
