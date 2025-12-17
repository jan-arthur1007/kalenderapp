// Hjem-skjermen: viser neste avtaler og opptatte tider fra Google-kalender
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import styles, { colors } from '../styles/styles';
import homeStyles from '../styles/homeScreenStyles';
import { auth, database } from '../database/firebase';
import { hasGoogleClientId } from '../services/googleCalendar';
import { requestFreeBusyViaBackend } from '../services/freeBusy';
import { get, ref } from 'firebase/database';

const DEFAULT_RANGE_DAYS = 3;

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

  const loadAvailability = useCallback(async () => {
    // Henter opptatte tidsrom for brukerens primærkalender via backend
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

  const handleDelete = (item) => {
    if (!deleteAppointment) return;
    // Bekrefter sletting av avtale (og Google-event via backend)
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

  // Renders ett listeelement (avtale-kort)
  const renderItem = ({ item }) => {
    const participantsText =
      item.participants && item.participants.length ? item.participants.join(', ') : '—';

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
        onPress={() => navigation.navigate('AppointmentDetails', { appointment: item })}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDate}>{formatRange()}</Text>
        </View>
        {item.groupName ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            Gruppe: {item.groupName}
          </Text>
        ) : null}
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          Deltakere: {participantsText}
        </Text>
        <View style={homeStyles.actionsRow}>
          {deleteAppointment ? (
            <TouchableOpacity onPress={() => handleDelete(item)}>
              <Text style={homeStyles.deleteText}>Slett</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const busyHeader = useMemo(() => {
    if (!hasGoogleClientId()) {
      return <Text style={styles.cardSubtitle}>Koble til Google for å vise kalenderen.</Text>;
    }
    if (loadingBusy) {
      return <ActivityIndicator color={colors.primary} style={homeStyles.busySpinner} />;
    }
    if (busyError) {
      return <Text style={[styles.cardSubtitle, homeStyles.busyError]}>{busyError}</Text>;
    }
    if (!busyTimes.length) {
      return <Text style={styles.cardSubtitle}>Ingen opptatte tider i valgt periode.</Text>;
    }
    return busyTimes.slice(0, 5).map((slot, index) => (
      <View
        key={`${slot.start.toISOString()}-${index}`}
        style={[homeStyles.busyRow, index === 0 && homeStyles.busyRowFirst]}
      >
        <Text style={styles.cardSubtitle}>{formatIntervalLabel(slot)}</Text>
      </View>
    ));
  }, [busyTimes, busyError, loadingBusy]);

  return (
    <SafeAreaView style={[styles.screenContainer, homeStyles.safeArea]} edges={['top', 'left', 'right']}>
      <Text style={homeStyles.title}>FREEBUSY</Text>
      <View style={[styles.card, homeStyles.busyCard]}>
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
          style={homeStyles.refreshButton}
          onPress={loadAvailability}
          disabled={loadingBusy}
        >
          <Text style={homeStyles.refreshText}>
            {loadingBusy ? 'Oppdaterer...' : 'Oppdater'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={homeStyles.sectionTitle}>Dine avtaler</Text>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={appointments.length ? undefined : homeStyles.emptyContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>Ingen avtaler enda</Text>}
      />
    </SafeAreaView>
  );
}
