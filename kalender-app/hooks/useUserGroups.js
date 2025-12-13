import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../database/firebase';

// Abonnerer på grupper for gitt bruker og returnerer sortert liste
export default function useUserGroups(uid) {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!uid) {
      setGroups([]);
      return undefined;
    }

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

    return unsubscribe;
  }, [uid]);

  return groups;
}
