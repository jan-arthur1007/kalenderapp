import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onValue, ref, update } from 'firebase/database';
import styles from '../styles/styles';
import { auth, database } from '../database/firebase';

const sanitize = (value = '') =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_');

const useFriendList = (uid) => {
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    if (!uid) {
      setFriends([]);
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
      },
      () => setFriends([])
    );

    return unsubscribe;
  }, [uid]);

  return friends;
};

export default function GroupDetailsScreen({ route, navigation }) {
  const { groupId } = route.params || {};
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;
  const email = currentUser?.email || '';
  const username = currentUser?.displayName || sanitize(email) || uid;

  const friends = useFriendList(uid);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({});
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const groupRef = ref(database, `groups/${groupId}`);
    const unsubscribe = onValue(
      groupRef,
      (snapshot) => {
        const data = snapshot.val();
        setGroup(data);
        setGroupName(data?.name || '');
        setSelected({ ...(data?.members || {}) });
        setLoading(false);
      },
      () => {
        setLoading(false);
        setGroup(null);
      }
    );

    return unsubscribe; // avslutt RTDB-lytting når skjermen lukkes
  }, [groupId]);

  const isOwner = group?.ownerUid === uid;

  const membersArray = useMemo(() => {
    const raw = selected || {};
    return Object.keys(raw).map((key) => raw[key]);
  }, [selected]);

  const toggleMember = (memberUid) => {
    if (!isOwner || memberUid === group?.ownerUid) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[memberUid]) {
        delete next[memberUid];
      } else if (group?.members?.[memberUid]) {
        next[memberUid] = group.members[memberUid];
      }
      return next;
    });
  };

  const toggleFriend = (friend) => {
    if (!isOwner) return;
    setSelected((prev) => {
      const exists = !!prev[friend.uid];
      const next = { ...prev };
      if (exists) {
        delete next[friend.uid];
      } else {
        next[friend.uid] = {
          uid: friend.uid,
          username: friend.username,
          email: friend.email || '',
        };
      }
      return next;
    });
  };

  // Holder orden på hvem som er markert slik at vi kan slå dem opp raskt
  const selectedFriendIds = useMemo(() => new Set(Object.keys(selected || {})), [selected]);

  const handleSave = async () => {
    if (!uid || !group) {
      return;
    }

    const trimmedName = (groupName || '').trim();
    if (!trimmedName) {
      Alert.alert('Manglende navn', 'Gruppen må ha et navn.');
      return;
    }

    const finalMembers = { ...selected };
    // Sørg for at eier alltid er med i medlemslisten
    finalMembers[uid] = {
      uid,
      username,
      email,
    };

    const memberIds = Object.keys(finalMembers);
    const memberCount = memberIds.length;

    try {
      setSaving(true);
      const updates = {
        [`groups/${groupId}/name`]: trimmedName,
        [`groups/${groupId}/members`]: finalMembers,
      };

      // Fjern userGroups for de som ikke lenger er med
      const previousIds = Object.keys(group.members || {});
      previousIds
        .filter((memberUid) => !finalMembers[memberUid])
        .forEach((memberUid) => {
          updates[`userGroups/${memberUid}/${groupId}`] = null;
        });

      // Oppdater userGroups for nye/nåværende slik at alle ser gruppen i listen sin
      memberIds.forEach((memberUid) => {
        updates[`userGroups/${memberUid}/${groupId}`] = {
          id: groupId,
          name: trimmedName,
          ownerUid: group.ownerUid,
          ownerName: group.ownerName || username,
          createdAt: group.createdAt,
          memberCount,
        };
      });

      await update(ref(database), updates);
      Alert.alert('Lagret', 'Gruppen ble oppdatert.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Feil', err.message || 'Kunne ikke oppdatere gruppen.');
    } finally {
      setSaving(false);
    }
  };

  // Fjerner gruppen og alle referanser fra userGroups
  const handleDelete = async () => {
    if (!uid || !group) return;
    Alert.alert('Slett gruppe', 'Er du sikker på at du vil slette gruppen?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          try {
            const updates = {
              [`groups/${groupId}`]: null,
            };
            Object.keys(group.members || {}).forEach((memberUid) => {
              updates[`userGroups/${memberUid}/${groupId}`] = null;
            });
            await update(ref(database), updates);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Feil', err.message || 'Kunne ikke slette gruppen.');
          }
        },
      },
    ]);
  };

  // Gir medlemmer mulighet til å forlate gruppen uten å slette den
  const handleLeave = async () => {
    if (!uid || !group) return;
    Alert.alert('Forlat gruppe', 'Er du sikker på at du vil forlate gruppen?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Forlat',
        style: 'destructive',
        onPress: async () => {
          try {
            const updates = {
              [`groups/${groupId}/members/${uid}`]: null,
              [`userGroups/${uid}/${groupId}`]: null,
            };
            await update(ref(database), updates);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Feil', err.message || 'Kunne ikke forlate gruppen.');
          }
        },
      },
    ]);
  };

  if (loading || !group) {
    return (
      <View style={[styles.screenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        {loading ? <ActivityIndicator size="large" color="#2fad67" /> : <Text style={styles.emptyText}>Fant ikke gruppedata.</Text>}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Gruppe</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Navn</Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          style={styles.input}
          editable={isOwner}
        />
      </View>

      <Text style={styles.label}>Medlemmer</Text>
      {membersArray.map((member) => (
        <TouchableOpacity
          key={member.uid}
          style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
          onPress={() => toggleMember(member.uid)}
          disabled={!isOwner || member.uid === uid}
        >
          <View>
            <Text style={styles.cardTitle}>{member.username || member.uid}</Text>
            <Text style={styles.cardSubtitle}>{member.email || member.uid}</Text>
          </View>
          {isOwner && member.uid !== uid ? (
            <Text style={{ color: '#dc2626' }}>Fjern</Text>
          ) : member.uid === uid ? (
            <Text style={{ color: '#9ca3af' }}>Deg</Text>
          ) : null}
        </TouchableOpacity>
      ))}

      {isOwner ? (
        // Eier kan invitere flere venner direkte fra listen sin
        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Legg til venner</Text>
          {friends.length ? (
            friends.map((friend) => {
              const checked = selectedFriendIds.has(friend.uid);
              return (
                <TouchableOpacity
                  key={friend.uid}
                  style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  onPress={() => toggleFriend(friend)}
                >
                  <View>
                    <Text style={styles.cardTitle}>{friend.username || friend.uid}</Text>
                    <Text style={styles.cardSubtitle}>{friend.email || friend.uid}</Text>
                  </View>
                  <Text style={{ color: checked ? '#2fad67' : '#9ca3af' }}>{checked ? 'Valgt' : 'Velg'}</Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>Ingen venner å legge til.</Text>
          )}
        </View>
      ) : null}

      <View style={{ marginTop: 24 }}>
        {isOwner ? (
          <Button title={saving ? 'Lagrer…' : 'Lagre endringer'} onPress={handleSave} disabled={saving} />
        ) : (
          <Button title="Forlat gruppe" onPress={handleLeave} />
        )}
      </View>

      {isOwner ? (
        // Gir eier en enkel måte å slette hele gruppen
        <View style={{ marginTop: 12 }}>
          <Button title="Slett gruppe" onPress={handleDelete} color="#dc2626" />
        </View>
      ) : null}
    </ScrollView>
  );
}
