// Hjem-skjermen: viser en liste over avtaler og lar brukeren
// trykke på en avtale for å se detaljer.
import React, { useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Text, Alert } from 'react-native';
import styles from '../styles /styles';
import { auth } from '../database/firebase';
import { linkGoogleCalendar, hasGoogleClientId, promptMissingClientId } from '../services/googleCalendar';

export default function HomeScreen({ navigation, appointments = [] }) {
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
