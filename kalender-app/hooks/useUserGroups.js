import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../database/firebase';

// Abonnerer på grupper for gitt bruker og returnerer sortert liste
export default function useUserGroups(uid) {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    // Ingen bruker -> tom liste og ingen lytter
    if (!uid) {
      setGroups([]);
      return undefined;
    }

    // Lytt til /userGroups/{uid} og bygg liste av grupper
    const groupsRef = ref(database, `userGroups/${uid}`);
    const unsubscribe = onValue(
      groupsRef,
      (snapshot) => {
        const raw = snapshot.val() || {};
        const list = Object.keys(raw).map((key) => ({ id: key, ...raw[key] }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setGroups(list);
      },
      () => setGroups([])
    );

    // Rydder opp lytteren ved unmount/bytte av uid
    return unsubscribe;
  }, [uid]);

  return groups;
}
