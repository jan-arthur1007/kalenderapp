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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import styles from '../styles/styles';
import { auth } from '../database/firebase';
import {
  linkGoogleCalendar,
  hasGoogleClientId,
  promptMissingClientId,
} from '../services/googleCalendar';
import { requestFreeBusyViaBackend } from '../services/freeBusy';
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
    color: '#2fad67',
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

      const data = await requestFreeBusyViaBackend({ timeMin, timeMax });
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
            await deleteAppointment(item);
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
    const formatRange = () => {
      if (item.startsAt && item.endsAt) {
        const start = new Date(item.startsAt);
        const end = new Date(item.endsAt);
        const dateOpts = { day: '2-digit', month: 'short', year: 'numeric' };
        const timeOpts = { hour: '2-digit', minute: '2-digit' };
        return `${start.toLocaleDateString('no-NO', dateOpts)} ${start.toLocaleTimeString([], timeOpts)} – ${end.toLocaleDateString('no-NO', dateOpts)} ${end.toLocaleTimeString([], timeOpts)}`;
      }
      return item.date || '';
    };

    return (
      <TouchableOpacity
        style={styles.card}
        // Navigerer til detaljskjermen og sender med valgt avtale
        onPress={() => navigation.navigate('AppointmentDetails', { appointment: item })}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDate}>{formatRange()}</Text>
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
      return <ActivityIndicator color="#2fad67" style={{ marginTop: 12 }} />;
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
    <SafeAreaView style={[styles.screenContainer, { paddingTop: 8 }]} edges={['top', 'left', 'right']}>
      <Text style={[styles.screenTitle, { color: '#0f172a', fontSize: 26, letterSpacing: 0.5 }]}>FREEBUSY</Text>
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
          <Text style={{ color: styles.cardSubtitle.color, fontWeight: '600' }}>
            {loadingBusy ? 'Oppdaterer...' : 'Oppdater'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.screenTitle, { marginTop: 4, marginBottom: 8, fontSize: 18 }]}>Dine avtaler</Text>
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

    </SafeAreaView>
  );
}
