import { get, push, ref, update } from 'firebase/database';
import { auth, database } from '../database/firebase';
import { deleteCalendarEvent } from './calendarEvents';

// Henter et brukernavn (eller e-post) for brukeren som er innlogget nå
const currentUserName = () =>
  auth.currentUser?.displayName ||
  auth.currentUser?.email ||
  'Ukjent bruker';

export async function addAppointment(uid, newItem) {
  if (!uid) throw new Error('Ingen bruker logget inn');

  // Oppretter ny avtale for eier
  const ownerRef = ref(database, `appointments/${uid}`);
  const newRef = push(ownerRef);
  const appointmentId = newRef.key;
  const createdAt = Date.now();

  let participants = [currentUserName()];
  let groupMembers = null;
  if (newItem.groupId) {
    const membersSnap = await get(ref(database, `groups/${newItem.groupId}/members`));
    if (membersSnap.exists()) {
      groupMembers = membersSnap.val() || {};
      const memberNames = Object.values(groupMembers).map(
        (m) => m.username || m.email || m.uid
      );
      if (memberNames.length) {
        participants = memberNames;
      }
    }
  }

  // Payload for eier
  const payload = {
    ...newItem,
    id: appointmentId,
    createdAt,
    ownerUid: uid,
    participants,
  };

  const updates = {
    [`appointments/${uid}/${appointmentId}`]: payload,
  };

  // Hvis gruppe: legg inn hos alle gruppemedlemmer
  if (groupMembers) {
    Object.keys(groupMembers).forEach((memberUid) => {
      updates[`appointments/${memberUid}/${appointmentId}`] = {
        ...payload,
        sharedWithGroup: true,
      };
    });
  }

  await update(ref(database), updates);
  return appointmentId;
}

export async function updateAppointment(uid, appointmentId, changes) {
  if (!uid) throw new Error('Ingen bruker logget inn');
  const snap = await get(ref(database, `appointments/${uid}/${appointmentId}`));
  if (!snap.exists()) throw new Error('Fant ikke avtalen.');
  const current = snap.val();
  const groupId = current.groupId || null;
  const payload = { ...current, ...changes };
  const updates = {
    [`appointments/${uid}/${appointmentId}`]: payload,
  };
  if (groupId) {
    const membersSnap = await get(ref(database, `groups/${groupId}/members`));
    if (membersSnap.exists()) {
      const members = membersSnap.val() || {};
      Object.keys(members).forEach((memberUid) => {
        updates[`appointments/${memberUid}/${appointmentId}`] = {
          ...payload,
          sharedWithGroup: true,
        };
      });
    }
  }
  await update(ref(database), updates);
}

export async function deleteAppointment(uid, appointment) {
  if (!uid) throw new Error('Ingen bruker logget inn');
  if (!appointment || !appointment.id) return;
  const appointmentId = appointment.id;
  const snap = await get(ref(database, `appointments/${uid}/${appointmentId}`));
  if (!snap.exists()) return;
  const current = snap.val();
  const groupId = current.groupId || null;

  // Forsøk å slette i Google-kalender hvis vi har eventId
  if (current.googleEventId) {
    deleteCalendarEvent({ appointmentId, eventId: current.googleEventId, ownerUid: uid }).catch(() => null);
  }

  // Slett fra eier + alle gruppemedlemmer
  const updates = {
    [`appointments/${uid}/${appointmentId}`]: null,
  };
  if (groupId) {
    const membersSnap = await get(ref(database, `groups/${groupId}/members`));
    if (membersSnap.exists()) {
      const members = membersSnap.val() || {};
      Object.keys(members).forEach((memberUid) => {
        updates[`appointments/${memberUid}/${appointmentId}`] = null;
      });
    }
  }
  await update(ref(database), updates);
}
