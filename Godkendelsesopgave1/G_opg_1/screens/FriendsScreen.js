// Venner-skjermen tilbyr søk, forslag, venneliste og kort vei til gruppering.
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { onValue, ref, get, update } from 'firebase/database';
import styles from '../styles /styles';
import { auth, database } from '../database/firebase';

// Normaliserer input slik at vi kan gjøre case-insensitive søk
const sanitize = (value) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_');

// Hook som abonnerer på vennelisten for gitt bruker
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

// Hook som abonnerer på gruppene som brukeren er medlem av
const useGroups = (uid) => {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    if (!uid) {
      setGroups([]);
      return () => undefined;
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
};

export default function FriendsScreen({ navigation }) {
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;
  const email = currentUser?.email || '';
  const displayName = currentUser?.displayName || email.split('@')[0] || uid;

  const { friends, loading } = useFriendList(uid);
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.uid)), [friends]);
  // Egne og delte grupper for brukeren
  const groups = useGroups(uid);

  const [allUsers, setAllUsers] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const [feedback, setFeedback] = useState('');

  // Leser alle profiler for å vise forslag i søkefeltet
  useEffect(() => {
    const usersRef = ref(database, 'usernames');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const raw = snapshot.val() || {};
      const list = Object.keys(raw).map((key) => ({
        uid: key,
        username: raw[key]?.username || raw[key]?.displayName || key,
        username_lower: sanitize(raw[key]?.username_lower || raw[key]?.username || ''),
        email: raw[key]?.email || '',
      }));
      setAllUsers(list);
    });
    return unsubscribe;
  }, []);

  const normalizedSearch = sanitize(searchValue);
  const userIndex = useMemo(() => {
    const index = {};
    allUsers.forEach((user) => {
      index[user.uid] = user;
    });
    return index;
  }, [allUsers]);
  const suggestions = useMemo(() => {
    if (!normalizedSearch) {
      return [];
    }
    return allUsers
      .filter((user) => user.uid !== uid && !friendIds.has(user.uid))
      .filter((user) => (user.username_lower || '').includes(normalizedSearch))
      .slice(0, 7);
  }, [normalizedSearch, allUsers, uid, friendIds]);

  // Søker etter eksakt brukernavn ved Enter/Søk-knappen
  const handleSearch = async () => {
    const term = sanitize(searchValue);
    setFeedback('');
    if (!term) {
      setSearchResult(null);
      return;
    }

    try {
      setSearching(true);
      const indexSnap = await get(ref(database, `usernameIndex/${term}`));
      if (!indexSnap.exists()) {
        setSearchResult({ type: 'empty' });
        return;
      }

      const friendUid = indexSnap.val();
      if (friendUid === uid) {
        setSearchResult({ type: 'self' });
        return;
      }
      if (friendIds.has(friendUid)) {
        setSearchResult({ type: 'already' });
        return;
      }

      const profileSnap = await get(ref(database, `usernames/${friendUid}`));
      if (!profileSnap.exists()) {
        setSearchResult({ type: 'missing' });
        return;
      }

      const profile = profileSnap.val() || {};
      setSearchResult({
        type: 'result',
        uid: friendUid,
        profile: {
          ...profile,
          username_lower: sanitize(profile.username_lower || profile.username || ''),
        },
      });
    } catch (err) {
      Alert.alert('Feil', err.message || 'Kunne ikke søke etter brukere.');
    } finally {
      setSearching(false);
    }
  };

  // Oppretter toveis vennskapskant i RTDB
  const handleAddFriend = async () => {
    if (!uid || !searchResult || searchResult.type !== 'result') {
      return;
    }

    const { uid: friendUid, profile } = searchResult;
    const now = Date.now();
    const friendUsername = profile.username || profile.displayName || friendUid;
    const friendUsernameLower =
      profile.username_lower || sanitize(profile.username || profile.displayName || friendUid);

    const selfUsernameLower = sanitize(displayName);

    const updates = {
      [`friends/${uid}/${friendUid}`]: {
        uid: friendUid,
        username: friendUsername,
        username_lower: friendUsernameLower,
        email: profile.email || '',
        addedAt: now,
      },
      [`friends/${friendUid}/${uid}`]: {
        uid,
        username: displayName,
        username_lower: selfUsernameLower,
        email,
        addedAt: now,
      },
    };

    try {
      await update(ref(database), updates);
      setFeedback('Venn lagt til!');
      setSearchResult(null);
      setSearchValue('');
    } catch (err) {
      Alert.alert('Feil', err.message || 'Kunne ikke legge til venn.');
    }
  };

  const renderFriend = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.username || 'Ukjent bruker'}</Text>
      <Text style={styles.cardSubtitle}>{item.email || item.uid}</Text>
    </View>
  );

  // Gir brukerlesbare meldinger for søkeresultatet
  const getResultMessage = () => {
    if (!searchResult) return null;
    switch (searchResult.type) {
      case 'empty':
        return 'Fant ingen bruker med dette navnet.';
      case 'self':
        return 'Dette er deg selv.';
      case 'already':
        return 'Dere er allerede venner.';
      case 'missing':
        return 'Brukeren mangler profildata.';
      default:
        return null;
    }
  };

  if (!uid) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Du må være logget inn for å se venner.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={styles.screenTitle}>Venner</Text>
        <Button
          title="Ny gruppe"
          onPress={() => {
            const parent = navigation.getParent?.();
            if (parent) {
              parent.navigate('CreateGroup');
            } else {
              navigation.navigate('CreateGroup');
            }
          }}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Søk etter brukernavn</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            placeholder="Søk ..."
            value={searchValue}
            onChangeText={setSearchValue}
            autoCapitalize="none"
            style={[styles.input, { flex: 1, marginRight: 12 }]}
          />
          <Button title="Søk" onPress={handleSearch} disabled={searching} />
        </View>
        {searching ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        {getResultMessage() ? (
          <Text style={{ marginTop: 8, color: '#6b7280' }}>{getResultMessage()}</Text>
        ) : null}
        {searchResult?.type === 'result' ? (
          <View style={[styles.card, { marginTop: 12 }]}> 
            <Text style={styles.cardTitle}>{searchResult.profile.username}</Text>
            <Text style={styles.cardSubtitle}>{searchResult.profile.email || 'Ingen e-post'}</Text>
            <Button title="Legg til venn" onPress={handleAddFriend} />
          </View>
        ) : null}
        {suggestions.length ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>Forslag</Text>
            {/* Viser de beste matchene mens man skriver */}
            {suggestions.map((user) => (
              <Button
                key={user.uid}
                title={`${user.username} (${user.email || 'uten e-post'})`}
                onPress={() => {
                  setSearchValue(user.username);
                  setSearchResult({ type: 'result', uid: user.uid, profile: user });
                  setFeedback('');
                }}
              />
            ))}
          </View>
        ) : null}
        {feedback ? (
          <Text style={{ marginTop: 8, color: '#2563eb' }}>{feedback}</Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator />
        ) : friends.length ? (
          // Viser vennene fra RTDB
          <FlatList data={friends} keyExtractor={(item) => item.uid} renderItem={renderFriend} />
        ) : (
          <Text style={styles.emptyText}>Ingen venner ennå. Legg til en venn for å starte.</Text>
        )}
      </View>

      {/* Viser gruppene bruker er med i, med snarvei til detaljer */}
      <View style={{ marginTop: 24 }}>
        <Text style={styles.screenTitle}>Dine grupper</Text>
        {groups.length ? (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => {
                    const parent = navigation.getParent?.();
                    if (parent) {
                    parent.navigate('GroupDetails', { groupId: item.id });
                  } else {
                    navigation.navigate('GroupDetails', { groupId: item.id });
                  }
                }}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.memberCount || '-'} medlemmer • Eier: {
                    item.ownerUid === uid
                      ? 'deg'
                      : item.ownerName || userIndex[item.ownerUid]?.username || item.ownerUid
                  }
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text style={styles.emptyText}>Ingen grupper enda.</Text>
        )}
      </View>
    </View>
  );
}
