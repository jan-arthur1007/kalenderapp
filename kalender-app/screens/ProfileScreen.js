// Profil-fanen viser enkel info om innlogget bruker og lar deg logge ut.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onValue, ref } from 'firebase/database';
import { signOut } from 'firebase/auth';
import styles from '../styles/styles';
import profileStyles from '../styles/profileScreenStyles';
import { auth, database } from '../database/firebase';
import {
  linkGoogleCalendar,
  hasGoogleClientId,
  promptMissingClientId,
} from '../services/googleCalendar';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Abonnerer på RTDB for å få oppdatert profilinfo
  useEffect(() => {
    const current = auth.currentUser;
    if (!current) {
      setLoading(false);
      setProfile(null);
      return () => undefined;
    }

    const profileRef = ref(database, `usernames/${current.uid}`);
    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        setProfile(snapshot.val() || {});
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      Alert.alert('Kunne ikke logge ut', err.message || 'Prøv igjen.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.screenContainer, profileStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={profileStyles.loadingColor.color} />
      </View>
    );
  }

  if (!auth.currentUser) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.emptyText}>Du er ikke logget inn.</Text>
      </View>
    );
  }

  const current = auth.currentUser;
  const profileData = profile || {};

  const fromProfile = profileData.username || profileData.username_lower;
  const fallbackFromAuth = current?.displayName || sanitizeFallback(current?.email);
  const username = fromProfile || fallbackFromAuth || current?.uid || '—';
  const email = profileData.email || current?.email || '—';
  const display = current?.displayName || fromProfile || username;

  return (
    <SafeAreaView style={[styles.screenContainer, profileStyles.safeArea]} edges={['top', 'left', 'right']}>
      <Text style={styles.screenTitle}>Profil</Text>

      <ProfileRow label="Brukernavn" value={username} />
      <ProfileRow label="E-post" value={email} />
      <ProfileRow label="Visningsnavn" value={display} />

      <TouchableOpacity
        style={profileStyles.googleButton}
        onPress={() => {
          if (!hasGoogleClientId()) {
            promptMissingClientId();
            return;
          }
          linkGoogleCalendar(current).catch((error) => {
            console.log('Google Calendar link failed:', error);
            Alert.alert('Feil', 'Klarte ikke å koble til Google-kalenderen. Prøv igjen.');
          });
        }}
      >
        <Text style={profileStyles.googleButtonText}>
          Koble til Google-kalender
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, { marginTop: 20 }]}
        onPress={handleSignOut}
      >
        <Text style={styles.primaryButtonText}>Logg ut</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Trekker ut brukernavn fra e-post dersom displayName mangler
const sanitizeFallback = (email = '') => {
  if (!email.includes('@')) {
    return email;
  }
  return email.split('@')[0] || email;
};

function ProfileRow({ label, value }) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={profileStyles.profileValueBox}>
        <Text style={profileStyles.profileValueText}>{value || '—'}</Text>
      </View>
    </View>
  );
}
