// Firebase Functions (gen2): Google-kalender auth + free/busy + create/delete.
// Klienten (Expo) kaller disse endepunktene for å koble til, lese opptatte tider
// og opprette/slette hendelser i brukers primærkalender.

// Tokens lagres i RTDB og fornyes med refresh_token der det er mulig.
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

// Brukes til å refreshe access token med refresh token
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

// Kaller Google Calendar API for å opprette event i primærkalender
async function insertCalendarEvent(accessToken, { summary, description, startDateTime, endDateTime, attendees }) {
  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      attendees: attendees?.length ? attendees.map((email) => ({ email })) : undefined,
      reminders: { useDefault: true },
      sendUpdates: 'all',
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message = json.error?.message || 'Kunne ikke opprette kalenderhendelse.';
    throw new Error(message);
  }
  return json;
}

// 1) START: /authStart – klienten åpner denne for å sende bruker til Google OAuth
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

    
    const scope = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.freebusy',
    ].join(' ');

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
    // (accessToken brukes til kall; refreshToken for fornyelse)
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
  // Wrapper rundt Google freeBusy API
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
  // Slår sammen overlappende intervaller innenfor tidsvinduet.
  // 1) Klipper bort alt utenfor [windowStart, windowEnd]
  // 2) Sorterer på starttid
  // 3) Fletter overlapp som ett langt intervall
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
  // Beregner ledige slotter ut fra opptatte intervaller og et gitt tidsvindu:
  // 1) Fletter busy intervaller
  // 2) Går sekvensielt fra start->slutt og samler hullene (ledige perioder)
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

// 3) /fetchFreeBusy  - henter busy-liste for én bruker (fornyer accessToken ved behov).
exports.fetchFreeBusy = functions.https.onRequest(async (req, res) => {
  try {
    // Steg 1: Verifiser ID-token (kreves for å slå opp tokens for brukeren)
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).send('Mangler ID-token');
    }

    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    // Steg 2: Finn lagrede kalender-tokens i RTDB
    const calendarTokensSnap = await db.ref(`calendarTokens/${uid}`).once('value');
    const calendarTokens = calendarTokensSnap.val();
    if (!calendarTokens) {
      return res.status(404).send('Fant ingen Google-kalender for denne brukeren.');
    }

    // Steg 3: Refresh accessToken om det er utløpt og vi har refreshToken
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

    // Steg 4: Definer tidsvindu (default: nå -> 7 dager frem)
    const { timeMin, timeMax } = req.query;
    const now = new Date();
    const start = timeMin || now.toISOString();
    const end = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Steg 5: Kall Google freeBusy API for primærkalender
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
      return res.status(500).send(freeBusyJson.error?.message || 'Kunne ikke hente free/busy-data.');
    }

    // Steg 6: Returner rå free/busy-data til klienten
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

// 4) /groupFreeBusy  - henter busy-lister for alle gruppemedlemmer, finner felles ledig.
exports.groupFreeBusy = functions.https.onRequest(async (req, res) => {
  try {
    // Steg 1: Verifiser ID-token (må være medlem av gruppen)
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

    // Steg 2: Sett tidsvindu (default 3 dager fra nå)
    const now = new Date();
    const timeMin = req.query.timeMin || now.toISOString();
    const defaultMax = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = req.query.timeMax || defaultMax;

    // Steg 3: For hver medlem: hent (ev. refresh) token, les busy-intervaller
    const memberIds = Object.keys(group.members || {});
    const busyCombined = [];
    const missingMembers = [];

    for (const memberUid of memberIds) {
      // Hent token for hvert medlem, forsøk å refreshe hvis utløpt
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

    // Steg 4: Regn ut felles ledige slots (maks 10) og returner
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

// 5) OPPRETT EVENT: Oppretter kalenderhendelse for eieren (inviterer deltakere) – krever write-scope
exports.createEvent = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Kun POST er støttet.');
    }

    // Steg 1: Verifiser ID-token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).send('Mangler ID-token');
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Steg 2: Pakk input (og default verdier)
    const {
      appointmentId,
      title,
      description = '',
      startsAt,
      endsAt,
      groupId,
    } = req.body || {};

    if (!appointmentId || !title || !startsAt || !endsAt) {
      return res.status(400).send('Mangler felter (appointmentId, title, startsAt, endsAt).');
    }

    // Steg 3: Bekreft at avtalen tilhører bruker
    const ownerSnap = await db.ref(`appointments/${uid}/${appointmentId}`).once('value');
    if (!ownerSnap.exists()) {
      return res.status(403).send('Fant ikke avtale for bruker.');
    }

    // Steg 4: Hent deltakere (gruppemedlemmer) om gruppe finnes
    let attendees = [];
    if (groupId) {
      const groupSnap = await db.ref(`groups/${groupId}/members`).once('value');
      if (groupSnap.exists()) {
        const members = groupSnap.val() || {};
        attendees = Object.values(members)
          .map((m) => m.email || null)
          .filter(Boolean);
      }
    }

    // Fallback til eierens e-post
    if (!attendees.length && decoded.email) {
      attendees = [decoded.email];
    }

    // Steg 5: Bruk eierens kalender: hent (ev. refresh) token
    const tokenSnap = await db.ref(`calendarTokens/${uid}`).once('value');
    const tokenData = tokenSnap.val();
    if (!tokenData) {
      return res.status(400).send('Mangler Google-token for eier. Koble til Google på nytt.');
    }

    let accessToken = tokenData.accessToken;
    const expiresAt = tokenData.expiresAt || 0;
    if (Date.now() > expiresAt && tokenData.refreshToken) {
      try {
        const refreshed = await refreshAccessToken(tokenData.refreshToken);
        accessToken = refreshed.access_token;
        await db.ref(`calendarTokens/${uid}`).update({
          accessToken,
          expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
          updatedAt: Date.now(),
        });
      } catch (refreshErr) {
        return res.status(400).send('Kunne ikke refreshe token for eier. Koble til Google på nytt.');
      }
    }

    // Steg 6: Opprett event hos Google Calendar
    const json = await insertCalendarEvent(accessToken, {
      summary: title,
      description,
      startDateTime: startsAt,
      endDateTime: endsAt,
      attendees,
    });

    // Steg 7: Svar med eventId og antall inviterte
    return res.status(200).json({
      createdFor: 1,
      eventId: json.id,
      attendeesAdded: attendees.length,
    });
  } catch (err) {
    console.error('createEvent error', err);
    return res.status(500).send(err.message || 'Kunne ikke opprette kalenderhendelse.');
  }
  });

// 6) SLETT EVENT: Sletter kalenderhendelse for eier (krever write-scope)
exports.deleteEvent = functions.https.onRequest(async (req, res) => {
  console.log('deleteEvent body:', JSON.stringify(req.body));
  try {
    // Steg 1: Valider metode og hent (valgfritt) ID-token
    if (req.method !== 'POST') {
      return res.status(405).send('Kun POST er støttet.');
    }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let uid = null;
    try {
      if (idToken) {
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
      }
    } catch (err) {
      // Ignorer verifiseringsfeil og bruk ownerUid fra body som fallback
    }

    // Steg 2: Pakk parametre og bestem effektiv eier
    const { appointmentId, eventId, ownerUid } = req.body || {};

    const effectiveUid = uid || ownerUid;

    if (!appointmentId || !eventId || !effectiveUid) {
      return res.status(400).send('Mangler appointmentId, eventId eller ownerUid.');
    }

    // Steg 3: Forsøk å slette selv om DB-oppføringen er borte (idempotent) – men logg for innsikt
    const ownerSnap = await db.ref(`appointments/${effectiveUid}/${appointmentId}`).once('value');
    if (!ownerSnap.exists()) {
      console.log('deleteEvent: appointment missing in DB, attempting calendar delete anyway');
    }

    // Steg 4: Hent (ev. refresh) token for eier
    const tokenSnap = await db.ref(`calendarTokens/${effectiveUid}`).once('value');
    const tokenData = tokenSnap.val();
    if (!tokenData) {
      return res.status(400).send('Mangler Google-token for eier. Koble til Google på nytt.');
    }

    let accessToken = tokenData.accessToken;
    const expiresAt = tokenData.expiresAt || 0;
    if (Date.now() > expiresAt && tokenData.refreshToken) {
      try {
        const refreshed = await refreshAccessToken(tokenData.refreshToken);
        accessToken = refreshed.access_token;
        await db.ref(`calendarTokens/${effectiveUid}`).update({
          accessToken,
          expiresAt: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
          updatedAt: Date.now(),
        });
      } catch (refreshErr) {
        return res.status(400).send('Kunne ikke refreshe token for eier. Koble til Google på nytt.');
      }
    }

    // Steg 5: Slett event fra eierens primærkalender (ignorer 404)
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resp.ok && resp.status !== 404) {
      const txt = await resp.text();
      console.error('delete event error', resp.status, txt);
      return res.status(500).send('Kunne ikke slette kalenderhendelse.');
    }

    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('deleteEvent error', err);
    return res.status(500).send(err.message || 'Kunne ikke slette kalenderhendelse.');
  }
  });
