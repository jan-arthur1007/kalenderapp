// Skjerm som lar brukeren samle venner i en navngitt gruppe
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Button, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue, push, update } from 'firebase/database';
import styles from '../styles/styles';
import createGroupStyles from '../styles/createGroupScreenStyles';
import { auth, database } from '../database/firebase';

// Brukes for å lage et stabilt brukernavn-fallback
const sanitize = (value = '') =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_');

// Hook som lytter på vennene i Realtime Database
const useFriendList = (uid) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setFriends([]);
      setLoading(false);
      return () => undefined;
    }

    const friendsRef = ref(database, `friends/${uid}`);
    const unsubscribe = onValue(
      friendsRef,
      (snapshot) => {
        const raw = snapshot.val() || {};
        const list = Object.keys(raw).map((key) => ({ uid: key, ...raw[key] }));
        list.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        setFriends(list);
        setLoading(false);
      },
      () => {
        setFriends([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  return { friends, loading };
};

export default function CreateGroupScreen({ navigation }) {
  const user = auth.currentUser;
  const uid = user?.uid;
  const email = user?.email || '';
  const username = user?.displayName || sanitize(email) || uid;

  // Henter vennene og lasteindikator fra databasen
  const { friends, loading } = useFriendList(uid);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  // For UI: viser hvor mange venner som er krysset av (+ eier)
  const memberCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  // Slår av/på valgt-status for en venn
  const toggleFriend = (friendUid) => {
    setSelected((prev) => ({ ...prev, [friendUid]: !prev[friendUid] }));
  };

  const handleCreate = async () => {
    if (!uid) {
      Alert.alert('Ikke logget inn', 'Logg inn for å opprette grupper.');
      return;
    }

    const trimmed = groupName.trim();
    if (!trimmed) {
      Alert.alert('Manglende navn', 'Gi gruppen et navn.');
      return;
    }

    const chosen = friends.filter((friend) => selected[friend.uid]);
    if (!chosen.length) {
      Alert.alert('Ingen medlemmer', 'Velg minst én venn til gruppen.');
      return;
    }

    try {
      setSaving(true);
      const groupRef = push(ref(database, 'groups'));
      const groupId = groupRef.key;
      const now = Date.now();

      const members = {
        [uid]: {
          uid,
          username,
          email,
        },
      };

      chosen.forEach((friend) => {
        members[friend.uid] = {
          uid: friend.uid,
          username: friend.username,
          email: friend.email || '',
        };
      });

      // Forbereder batch med oppdateringer slik at grupper og medlemskap holder seg synkronisert
      // `updates` samler alle skriveoperasjoner slik at vi kan sende ett `update`
      const updates = {
        [`groups/${groupId}`]: {
          id: groupId,
          name: trimmed,
          ownerUid: uid,
          ownerName: username,
          createdAt: now,
          members,
        },
        [`userGroups/${uid}/${groupId}`]: {
          id: groupId,
          name: trimmed,
          ownerUid: uid,
          ownerName: username,
          createdAt: now,
          memberCount: Object.keys(members).length,
        },
      };

      chosen.forEach((friend) => {
        updates[`userGroups/${friend.uid}/${groupId}`] = {
          id: groupId,
          name: trimmed,
          ownerUid: uid,
          ownerName: username,
          createdAt: now,
          memberCount: Object.keys(members).length,
        };
      });

      await update(ref(database), updates);
      Alert.alert('Gruppe opprettet', 'Gruppen er lagret.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Feil', err.message || 'Kunne ikke opprette gruppen.');
    } finally {
      setSaving(false);
    }
  };

  if (!uid) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Logg inn for å opprette grupper.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screenContainer, createGroupStyles.safeArea]} edges={['top', 'left', 'right']}>
      <Text style={styles.screenTitle}>Ny gruppe</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Gruppenavn</Text>
        <TextInput
          placeholder="F.eks. Studiegruppe"
          value={groupName}
          onChangeText={setGroupName}
          style={styles.input}
        />
      </View>

      <Text style={[styles.label, createGroupStyles.friendsLabel]}>Velg venner</Text>
      {loading ? (
        <ActivityIndicator />
      ) : friends.length ? (
        // Viser alle venner slik at man kan krysse av med ett trykk
        <ScrollView style={createGroupStyles.friendsList}>
          {friends.map((friend) => {
            const checked = !!selected[friend.uid];
            return (
              <TouchableOpacity
                key={friend.uid}
                style={[
                  styles.card,
                  createGroupStyles.friendCard,
                  checked && createGroupStyles.friendCardChecked,
                ]}
                onPress={() => toggleFriend(friend.uid)}
              >
                <View>
                  <Text style={styles.cardTitle}>{friend.username || friend.uid}</Text>
                  <Text style={styles.cardSubtitle}>{friend.email || friend.uid}</Text>
                </View>
                <Text
                  style={[
                    createGroupStyles.friendStatusText,
                    checked && createGroupStyles.friendStatusTextChecked,
                  ]}
                >
                  {checked ? 'Valgt' : 'Velg'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>Du har ingen venner å legge til enda.</Text>
      )}

      <Button
        title={saving ? 'Lagrer…' : `Opprett gruppe (${memberCount + 1} medlemmer)`}
        onPress={handleCreate}
        disabled={saving || !friends.length}
      />
    </SafeAreaView>
  );
}
