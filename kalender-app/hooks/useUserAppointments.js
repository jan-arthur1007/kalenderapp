import { useEffect, useState } from 'react';
import { onValue, ref, update } from 'firebase/database';
import { database } from '../database/firebase';

// Returnerer avtaler for brukeren (oppdatert i sanntid)
export default function useUserAppointments(uid) {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    if (!uid) {
      setAppointments([]);
      return undefined;
    }

    const appointmentsRef = ref(database, `appointments/${uid}`);
    const unsubscribe = onValue(
      appointmentsRef,
      (snapshot) => {
        const raw = snapshot.val() || {};
        const now = Date.now();
        const list = Object.keys(raw).map((key) => raw[key]);

        // Fjern utløpte avtaler for denne brukeren
        const expired = list.filter((item) => {
          const end = item?.endsAt ? new Date(item.endsAt).getTime() : null;
          const start = item?.startsAt ? new Date(item.startsAt).getTime() : null;
          const t = end || start || item?.createdAt;
          return t && t < now;
        });
        if (expired.length) {
          const updates = {};
          expired.forEach((item) => {
            if (item?.id) {
              updates[`appointments/${uid}/${item.id}`] = null;
            }
          });
          if (Object.keys(updates).length) {
            update(ref(database), updates).catch(() => null);
          }
        }

        const upcoming = list.filter((item) => {
          const end = item?.endsAt ? new Date(item.endsAt).getTime() : null;
          const start = item?.startsAt ? new Date(item.startsAt).getTime() : null;
          const t = end || start || item?.createdAt;
          return !t || t >= now;
        });

        upcoming.sort((a, b) => {
          const aStart = a?.startsAt ? new Date(a.startsAt).getTime() : Infinity;
          const bStart = b?.startsAt ? new Date(b.startsAt).getTime() : Infinity;
          if (aStart === bStart) {
            return (a.createdAt || 0) - (b.createdAt || 0);
          }
          return aStart - bStart;
        });

        setAppointments(upcoming);
      },
      () => setAppointments([])
    );

    return unsubscribe;
  }, [uid]);

  return appointments;
}
