// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Init Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const auth = admin.auth();

// Les OAUTH-config kun fra miljøvariabler (.env lastes av firebase-tools ved deploy)
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || '';

function ensureOAuthConfig() {
  if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET || !OAUTH_REDIRECT_URI) {
    throw new Error(
      'Mangler OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / OAUTH_REDIRECT_URI (sett i .env eller deploy-miljøet)'
    );
  }
}

// Helper for å bygge Google OAuth URL
const buildGoogleAuthUrl = ({ scope, state }) => {
  ensureOAuthConfig();
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
  ensureOAuthConfig();
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
    ensureOAuthConfig();
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
    ensureOAuthConfig();
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

async function fetchBusyIntervals(accessToken, timeMin, timeMax) {
  const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    }),
  });
  const json = await resp.json();
  if (!resp.ok || json.error) {
    throw new Error(json.error?.message || 'Kunne ikke hente ledige tider.');
  }
  return json.calendars?.primary?.busy || [];
}

function mergeBusyIntervals(busyList, windowStart, windowEnd) {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const intervals = busyList
    .map((entry) => ({
      start: new Date(entry.start),
      end: new Date(entry.end),
    }))
    .filter((interval) => interval.end > start && interval.start < end)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  intervals.forEach((interval) => {
    if (!merged.length) {
      merged.push(interval);
      return;
    }
    const last = merged[merged.length - 1];
    if (interval.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), interval.end.getTime()));
    } else {
      merged.push(interval);
    }
  });
  return merged;
}

function computeFreeSlotsFromBusy(windowStart, windowEnd, busyIntervals) {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const mergedBusy = mergeBusyIntervals(busyIntervals, start, end);
  const freeSlots = [];
  let cursor = new Date(start);

  mergedBusy.forEach((interval) => {
    const busyStart = new Date(interval.start);
    const busyEnd = new Date(interval.end);
    if (busyStart > cursor) {
      freeSlots.push({
        start: new Date(cursor),
        end: new Date(Math.min(busyStart.getTime(), end.getTime())),
      });
    }
    if (busyEnd > cursor) {
      cursor = new Date(Math.min(busyEnd.getTime(), end.getTime()));
    }
  });

  if (cursor < end) {
    freeSlots.push({ start: new Date(cursor), end: new Date(end) });
  }

  return freeSlots.map((slot) => ({
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
  }));
}

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

exports.groupFreeBusy = functions.https.onRequest(async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).send('Mangler ID-token');
    }

    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const groupId = req.query.groupId;
    if (!groupId) {
      return res.status(400).send('Mangler groupId.');
    }

    const groupSnap = await db.ref(`groups/${groupId}`).once('value');
    if (!groupSnap.exists()) {
      return res.status(404).send('Fant ikke gruppen.');
    }
    const group = groupSnap.val();
    if (!group.members || !group.members[uid]) {
      return res.status(403).send('Du er ikke medlem av denne gruppen.');
    }

    const now = new Date();
    const timeMin = req.query.timeMin || now.toISOString();
    const defaultMax = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = req.query.timeMax || defaultMax;

    const memberIds = Object.keys(group.members || {});
    const busyCombined = [];
    const missingMembers = [];

    for (const memberUid of memberIds) {
      const tokenSnap = await db.ref(`calendarTokens/${memberUid}`).once('value');
      const tokenData = tokenSnap.val();
      if (!tokenData) {
        missingMembers.push(memberUid);
        continue;
      }
      let accessToken = tokenData.accessToken;
      const expiresAt = tokenData.expiresAt || 0;
      if (Date.now() > expiresAt && tokenData.refreshToken) {
        try {
          const refreshed = await refreshAccessToken(tokenData.refreshToken);
          accessToken = refreshed.access_token;
          await db.ref(`calendarTokens/${memberUid}`).update({
            accessToken,
            expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
            updatedAt: Date.now(),
          });
        } catch (refreshErr) {
          console.error('Kunne ikke refreshe token for', memberUid, refreshErr);
          missingMembers.push(memberUid);
          continue;
        }
      }

      try {
        const busy = await fetchBusyIntervals(accessToken, timeMin, timeMax);
        busyCombined.push(...busy);
      } catch (busyErr) {
        console.error('Kunne ikke hente busy for', memberUid, busyErr);
        missingMembers.push(memberUid);
      }
    }

    const freeSlots = computeFreeSlotsFromBusy(timeMin, timeMax, busyCombined).slice(0, 10);
    res.status(200).json({
      timeMin,
      timeMax,
      freeSlots,
      missingMembers,
    });
  } catch (err) {
    console.error('groupFreeBusy error', err);
    res.status(500).send('Noe gikk galt under gruppearbeidet.');
  }
  });
