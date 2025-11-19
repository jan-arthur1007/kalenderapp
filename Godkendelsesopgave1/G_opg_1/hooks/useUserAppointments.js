import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
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
        const list = Object.keys(raw).map((key) => raw[key]);
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAppointments(list);
      },
      () => setAppointments([])
    );

    return unsubscribe;
  }, [uid]);

  return appointments;
}
