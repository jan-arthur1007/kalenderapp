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

const computeFreeSlots = (timeMin, timeMax, calendars = {}) => {
  const windowStart = new Date(timeMin);
  const windowEnd = new Date(timeMax);
  const busy = (calendars.primary?.busy || [])
    .map((entry) => ({
      start: new Date(entry.start),
      end: new Date(entry.end),
    }))
    .sort((a, b) => a.start - b.start);

  let cursor = new Date(windowStart);
  const slots = [];

  busy.forEach((interval) => {
    const start = new Date(interval.start);
    const end = new Date(interval.end);
    if (end <= cursor) {
      if (end > cursor) cursor = end;
      return;
    }
    if (start > cursor) {
      slots.push({ start: new Date(cursor), end: new Date(start) });
    }
    if (end > cursor) {
      cursor = new Date(end);
    }
  });

  if (cursor < windowEnd) {
    slots.push({ start: cursor, end: windowEnd });
  }
  return slots;
};

const formatSlotLabel = (slot) => {
  const options = { hour: '2-digit', minute: '2-digit' };
  return `${slot.start.toLocaleDateString()} ${slot.start.toLocaleTimeString([], options)} – ${slot.end.toLocaleTimeString([], options)}`;
};

export default function HomeScreen({ navigation, appointments = [] }) {
  const [availability, setAvailability] = useState([]);
  const [availabilityWindow, setAvailabilityWindow] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const loadAvailability = useCallback(async () => {
    if (!hasGoogleClientId()) {
      setAvailability([]);
      setAvailabilityWindow(null);
      setAvailabilityError('');
      return;
    }
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
      setLoadingAvailability(true);
      setAvailabilityError('');
      const current = auth.currentUser;
      if (!current) {
        setAvailability([]);
        setAvailabilityWindow(null);
        setAvailabilityError('Logg inn for å vise ledige tider.');
        return;
      }
      const tokenSnap = await get(ref(database, `calendarTokens/${current.uid}`));
      if (!tokenSnap.exists()) {
        setAvailability([]);
        setAvailabilityWindow(null);
        setAvailabilityError('Google-kalenderen er ikke koblet til denne brukeren enda.');
        return;
      }
      const tokens = tokenSnap.val();
      const data = await requestFreeBusy(tokens.accessToken, { timeMin, timeMax });
      const slots = computeFreeSlots(data.timeMin || timeMin, data.timeMax || timeMax, data.calendars || {});
      setAvailability(slots);
      setAvailabilityWindow({ timeMin: data.timeMin || timeMin, timeMax: data.timeMax || timeMax });
    } catch (err) {
      setAvailabilityError(err.message || 'Kunne ikke hente tilgjengelighet.');
    } finally {
      setLoadingAvailability(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAvailability();
    }, [loadAvailability])
  );

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
  const renderItem = ({ item }) => (
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
        Deltakere: {(item.participants || []).join(', ')}
      </Text>
    </TouchableOpacity>
  );

  const availabilityHeader = useMemo(() => {
    if (!hasGoogleClientId()) {
      return (
        <Text style={styles.cardSubtitle}>
          Koble til Google for å vise ledige tider.
        </Text>
      );
    }
    if (loadingAvailability) {
      return <ActivityIndicator color="#2563eb" style={{ marginTop: 12 }} />;
    }
    if (availabilityError) {
      return (
        <Text style={[styles.cardSubtitle, { color: '#dc2626' }]}>
          {availabilityError}
        </Text>
      );
    }
    if (!availability.length) {
      return <Text style={styles.cardSubtitle}>Ingen ledige tider i valgt periode.</Text>;
    }
    return availability.slice(0, 5).map((slot, index) => (
      <View key={`${slot.start.toISOString()}-${index}`} style={{ marginTop: index === 0 ? 12 : 8 }}>
        <Text style={styles.cardSubtitle}>{formatSlotLabel(slot)}</Text>
      </View>
    ));
  }, [availability, availabilityError, loadingAvailability]);

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Dine avtaler</Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#2563eb',
          paddingVertical: 12,
          borderRadius: 8,
          marginBottom: 16,
        }}
        onPress={handleManualConnect}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
          Koble til Google-kalender
        </Text>
      </TouchableOpacity>
      <View style={[styles.card, { marginBottom: 16 }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Ledige tider</Text>
          {availabilityWindow ? (
            <Text style={styles.cardDate}>
              {new Date(availabilityWindow.timeMin).toLocaleDateString()} –{' '}
              {new Date(availabilityWindow.timeMax).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        {availabilityHeader}
        <TouchableOpacity
          style={{ marginTop: 12 }}
          onPress={loadAvailability}
          disabled={loadingAvailability}
        >
          <Text style={{ color: '#2563eb', fontWeight: '600' }}>
            {loadingAvailability ? 'Oppdaterer...' : 'Oppdater'}
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
    </View>
  );
}
