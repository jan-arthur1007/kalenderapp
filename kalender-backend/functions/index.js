// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Init Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const auth = admin.auth();

// 🔹 LES OAUTH-CONFIG FRA ENV-VARIABLER (kommer fra .env i functions/)
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI;

// Sjekk at alt er satt
if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET || !OAUTH_REDIRECT_URI) {
  throw new Error(
    'Mangler en eller flere env-variabler: OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / OAUTH_REDIRECT_URI'
  );
}

// Helper for å bygge Google OAuth URL
const buildGoogleAuthUrl = ({ scope, state }) => {
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope,
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Mangler refresh token');
  }
  const body = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await resp.json();
  if (!resp.ok || json.error) {
    throw new Error(json.error_description || json.error || 'Kunne ikke refreshe token');
  }
  return json;
}

// 1) START: /authStart – appen treffer dette via nettleser
exports.authStart = functions.https.onRequest(async (req, res) => {
  try {
    const uid = req.query.uid;
    console.log('authStart called with query:', req.query);

    if (!uid) {
      res.status(400).send('Mangler uid-parameter.');
      return;
    }

    const state = encodeURIComponent(uid);

    // Du kan bytte scope her om du vil
    const scope = 'https://www.googleapis.com/auth/calendar.freebusy';

    const url = buildGoogleAuthUrl({ scope, state });

    console.log('Redirecting to Google OAuth URL:', url);
    return res.redirect(302, url);
  } catch (err) {
    console.error('authStart error', err);
    res.status(500).send('Noe gikk galt i authStart.');
  }
});

// 2) CALLBACK: /authCallback – Google sender brukeren hit med ?code=&state=
exports.authCallback = functions.https.onRequest(async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;

    console.log('authCallback called with query:', req.query);

    if (!code || !state) {
      res.status(400).send('Mangler code eller state fra Google.');
      return;
    }

    const uid = decodeURIComponent(state);

    // Bytt code -> tokens hos Google
    const tokenParams = new URLSearchParams({
      code,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      redirect_uri: OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    const tokenJson = await tokenResponse.json();

    if (!tokenResponse.ok || tokenJson.error) {
      console.error('Token exchange error', tokenJson);
      res
        .status(500)
        .send(
          `Kunne ikke hente token fra Google: ${
            tokenJson.error_description || tokenJson.error || 'ukjent feil'
          }`
        );
      return;
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      scope,
      id_token,
      token_type,
    } = tokenJson;

    // Lagre tokens i Realtime Database under calendarTokens/{uid}
    await db.ref(`calendarTokens/${uid}`).set({
      accessToken: access_token,
      refreshToken: refresh_token || null,
      tokenType: token_type || 'Bearer',
      expiresAt: expires_in ? Date.now() + expires_in * 1000 : null,
      scope,
      idToken: id_token || null,
      updatedAt: Date.now(),
    });

    console.log('Tokens lagret for uid:', uid);

    // Enkel "ferdig"-side
    res.status(200).send(`<!doctype html>
<html lang="no">
  <head>
    <meta charset="utf-8" />
    <title>Google-kalender tilkoblet</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
             padding: 24px; max-width: 480px; margin: 40px auto; line-height: 1.5; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      p { font-size: 15px; color: #444; }
      button { margin-top: 24px; padding: 8px 16px; border-radius: 4px; border: none;
               background: #2563eb; color: white; font-size: 14px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>Google-kalender er nå tilkoblet ✅</h1>
    <p>Du kan nå lukke denne siden og gå tilbake til kalender-appen.</p>
    <button onclick="window.close()">Lukk vindu</button>
  </body>
</html>`);
  } catch (err) {
    console.error('authCallback error', err);
    res.status(500).send('Noe gikk galt i authCallback.');
  }
});

exports.fetchFreeBusy = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).send('Mangler ID-token');
    }

    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const calendarTokensSnap = await db.ref(`calendarTokens/${uid}`).once('value');
    const calendarTokens = calendarTokensSnap.val();
    if (!calendarTokens) {
      return res.status(404).send('Fant ingen Google-kalender for denne brukeren.');
    }

    let accessToken = calendarTokens.accessToken;
    const expiresAt = calendarTokens.expiresAt || 0;
    if (Date.now() > expiresAt && calendarTokens.refreshToken) {
      const refreshed = await refreshAccessToken(calendarTokens.refreshToken);
      accessToken = refreshed.access_token;
      await db.ref(`calendarTokens/${uid}`).update({
        accessToken,
        expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
        updatedAt: Date.now(),
      });
    }

    const { timeMin, timeMax } = req.query;
    const now = new Date();
    const start = timeMin || now.toISOString();
    const end = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const freeBusyResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: start,
        timeMax: end,
        items: [{ id: 'primary' }],
      }),
    });

    const freeBusyJson = await freeBusyResponse.json();
    if (!freeBusyResponse.ok) {
      console.error('freebusy error', freeBusyJson);
      return res
        .status(500)
        .send(freeBusyJson.error?.message || 'Kunne ikke hente free/busy-data.');
    }

    return res.status(200).json({
      timeMin: start,
      timeMax: end,
      calendars: freeBusyJson.calendars,
    });
  } catch (err) {
    console.error('fetchFreeBusy error', err);
    return res.status(500).send('Noe gikk galt under free/busy-henting.');
  }
});
