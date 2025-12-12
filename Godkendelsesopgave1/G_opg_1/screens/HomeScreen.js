// Hjem-skjermen: viser en liste over avtaler og lar brukeren
// trykke på en avtale for å se detaljer.
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import styles from '../styles /styles';
import { auth } from '../database/firebase';
import {
  linkGoogleCalendar,
  hasGoogleClientId,
  promptMissingClientId,
} from '../services/googleCalendar';
import { requestFreeBusy } from '../services/freeBusy';
import { database } from '../database/firebase';
import { get, ref } from 'firebase/database';

const DEFAULT_RANGE_DAYS = 3;

const localStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  cancel: {
    color: '#6b7280',
    fontWeight: '600',
  },
  save: {
    color: '#2563eb',
    fontWeight: '700',
  },
});

const formatIntervalLabel = (slot) => {
  const dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit' };
  return `${slot.start.toLocaleDateString('no-NO', dateOpts)} ${slot.start.toLocaleTimeString([], timeOpts)} – ${slot.end.toLocaleTimeString([], timeOpts)}`;
};

export default function HomeScreen({
  navigation,
  appointments = [],
  updateAppointment,
  deleteAppointment,
}) {
  const [busyTimes, setBusyTimes] = useState([]);
  const [busyWindow, setBusyWindow] = useState(null);
  const [busyError, setBusyError] = useState('');
  const [loadingBusy, setLoadingBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editId, setEditId] = useState(null);

  const loadAvailability = useCallback(async () => {
    if (!hasGoogleClientId()) {
      setBusyTimes([]);
      setBusyWindow(null);
      setBusyError('');
      return;
    }
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
      setLoadingBusy(true);
      setBusyError('');
      const current = auth.currentUser;
      if (!current) {
        setBusyTimes([]);
        setBusyWindow(null);
        setBusyError('Logg inn for å vise kalenderen.');
        return;
      }
      const tokenSnap = await get(ref(database, `calendarTokens/${current.uid}`));
      if (!tokenSnap.exists()) {
        setBusyTimes([]);
        setBusyWindow(null);
        setBusyError('Google-kalenderen er ikke koblet til denne brukeren enda.');
        return;
      }
      const tokens = tokenSnap.val();
      const data = await requestFreeBusy(tokens.accessToken, { timeMin, timeMax });
      const busy = (data.calendars?.primary?.busy || [])
        .map((entry) => ({
          start: new Date(entry.start),
          end: new Date(entry.end),
        }))
        .sort((a, b) => a.start - b.start);
      setBusyTimes(busy);
      setBusyWindow({ timeMin: data.timeMin || timeMin, timeMax: data.timeMax || timeMax });
    } catch (err) {
      setBusyError(err.message || 'Kunne ikke hente kalenderdata.');
    } finally {
      setLoadingBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAvailability();
    }, [loadAvailability])
  );

  const startEdit = (item) => {
    setEditId(item.id);
    setEditTitle(item.title || '');
    setEditDescription(item.description || '');
    setEditVisible(true);
  };

  const handleUpdate = async () => {
    if (!editId || !updateAppointment) return;
    try {
      await updateAppointment(editId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
      setEditVisible(false);
    } catch (err) {
      Alert.alert('Kunne ikke oppdatere', err.message || 'Prøv igjen.');
    }
  };

  const handleDelete = (item) => {
    if (!deleteAppointment) return;
    Alert.alert('Slett avtale', 'Er du sikker på at du vil slette avtalen?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Slett',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAppointment(item.id);
          } catch (err) {
            Alert.alert('Kunne ikke slette', err.message || 'Prøv igjen.');
          }
        },
      },
    ]);
  };

  const handleManualConnect = useCallback(async () => {
    if (!hasGoogleClientId()) {
      promptMissingClientId();
      return;
    }
    const current = auth.currentUser;
    if (!current) {
      Alert.alert('Ikke innlogget', 'Du må være innlogget før du kan koble til Google-kalenderen.');
      return;
    }
    try {
      await linkGoogleCalendar(current);
      Alert.alert('Google-kalender tilkoblet', 'Kalenderen er nå knyttet til kontoen din.');
    } catch (error) {
      console.log('Google Calendar link failed:', error);
      Alert.alert('Feil', 'Klarte ikke å koble til Google-kalenderen. Prøv igjen.');
    }
  }, []);

  // Renders ett listeelement (avtale-kort)
  const renderItem = ({ item }) => {
    const participantsText =
      item.participants && item.participants.length
        ? item.participants.join(', ')
        : '—';

    return (
      <TouchableOpacity
        style={styles.card}
        // Navigerer til detaljskjermen og sender med valgt avtale
        onPress={() => navigation.navigate('AppointmentDetails', { appointment: item })}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDate}>{item.date}</Text>
        </View>
        {/* Viser gruppetilknytning dersom avtalen er delt */}
        {item.groupName ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            Gruppe: {item.groupName}
          </Text>
        ) : null}
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          Deltakere: {participantsText}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
          {updateAppointment ? (
            <TouchableOpacity onPress={() => startEdit(item)}>
              <Text style={{ color: '#2563eb', fontWeight: '600' }}>Rediger</Text>
            </TouchableOpacity>
          ) : null}
          {deleteAppointment ? (
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Text style={{ color: '#dc2626', fontWeight: '600' }}>Slett</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const busyHeader = useMemo(() => {
    if (!hasGoogleClientId()) {
      return (
        <Text style={styles.cardSubtitle}>
          Koble til Google for å vise kalenderen.
        </Text>
      );
    }
    if (loadingBusy) {
      return <ActivityIndicator color="#2563eb" style={{ marginTop: 12 }} />;
    }
    if (busyError) {
      return (
        <Text style={[styles.cardSubtitle, { color: '#dc2626' }]}>
          {busyError}
        </Text>
      );
    }
    if (!busyTimes.length) {
      return <Text style={styles.cardSubtitle}>Ingen opptatte tider i valgt periode.</Text>;
    }
    return busyTimes.slice(0, 5).map((slot, index) => (
      <View key={`${slot.start.toISOString()}-${index}`} style={{ marginTop: index === 0 ? 12 : 8 }}>
        <Text style={styles.cardSubtitle}>{formatIntervalLabel(slot)}</Text>
      </View>
    ));
  }, [busyTimes, busyError, loadingBusy]);

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Dine avtaler</Text>
      <View style={[styles.card, { marginBottom: 16 }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Kalender (opptatt)</Text>
          {busyWindow ? (
            <Text style={styles.cardDate}>
              {new Date(busyWindow.timeMin).toLocaleDateString('no-NO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              –{' '}
              {new Date(busyWindow.timeMax).toLocaleDateString('no-NO', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          ) : null}
        </View>
        {busyHeader}
        <TouchableOpacity
          style={{ marginTop: 12 }}
          onPress={loadAvailability}
          disabled={loadingBusy}
        >
          <Text style={{ color: '#2563eb', fontWeight: '600' }}>
            {loadingBusy ? 'Oppdaterer...' : 'Oppdater'}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        // Selve data-listen
        data={appointments}
        // Stabil nøkkel hentet fra id
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        // Sentrerer tom visning dersom listen er tom
        contentContainerStyle={appointments.length ? null : { flex: 1, justifyContent: 'center' }}
        // Vises når listen er tom
        ListEmptyComponent={<Text style={styles.emptyText}>Ingen avtaler enda</Text>}
      />

      {/* Redigeringsmodal */}
      {editVisible && (
        <Modal visible transparent animationType="fade">
          <View style={localStyles.backdrop}>
            <View style={localStyles.modalCard}>
              <Text style={localStyles.modalTitle}>Rediger avtale</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Tittel"
                style={localStyles.input}
              />
              <TextInput
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Beskrivelse"
                multiline
                style={[localStyles.input, { height: 80 }]}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                <TouchableOpacity onPress={() => setEditVisible(false)}>
                  <Text style={localStyles.cancel}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleUpdate}>
                  <Text style={localStyles.save}>Lagre</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
