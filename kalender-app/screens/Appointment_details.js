// Detaljskjerm: viser informasjon om én valgt avtale, inkludert gruppevalg.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from '../styles/styles';
import appointmentStyles from '../styles/appointmentDetailsStyles';
import { database } from '../database/firebase';
import { get, ref } from 'firebase/database';

export default function AppointmentDetails({ route }) {
  // Henter avtalen som ble sendt via navigate(..., { appointment })
  const { appointment } = route.params || {};
  const [resolvedParticipants, setResolvedParticipants] = useState(appointment?.participants || []);

  useEffect(() => {
    let active = true;
    const loadParticipants = async () => {
      if (resolvedParticipants?.length) return;
      if (!appointment?.groupId) return;
      try {
        const snap = await get(ref(database, `groups/${appointment.groupId}/members`));
        if (!snap.exists()) return;
        const members = snap.val() || {};
        const names = Object.values(members).map((m) => m.username || m.email || m.uid);
        if (active) {
          setResolvedParticipants(names);
        }
      } catch (err) {
        // Ignorer feil i fallback-oppslag
      }
    };
    loadParticipants();
    return () => {
      active = false;
    };
  }, [appointment, resolvedParticipants]);

  // Hvis noe gikk galt med navigasjonen og vi mangler data
  if (!appointment) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Fant ikke avtaledetaljer.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.screenContainer, appointmentStyles.safeArea]}
      edges={['top', 'left', 'right']}
    >
      <Text style={styles.screenTitle}>{appointment.title}</Text>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Dato:</Text>
        <Text style={styles.detailValue}>{appointment.date}</Text>
      </View>
      {/* Viser hvilken gruppe som eier avtalen dersom satt */}
      {appointment.groupName ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Gruppe:</Text>
          <Text style={styles.detailValue}>{appointment.groupName}</Text>
        </View>
      ) : null}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Deltakere:</Text>
        <Text style={styles.detailValue}>{(resolvedParticipants || []).join(', ') || '—'}</Text>
      </View>
      <View style={[styles.detailRow, appointmentStyles.descriptionRow]}>
        <Text style={styles.detailLabel}>Beskrivelse:</Text>
        <Text style={styles.detailValue}>{appointment.description || '—'}</Text>
      </View>
    </SafeAreaView>
  );
}
