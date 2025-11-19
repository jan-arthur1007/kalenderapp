// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Init Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

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