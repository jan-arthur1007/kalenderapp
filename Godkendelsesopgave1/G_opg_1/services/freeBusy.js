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
