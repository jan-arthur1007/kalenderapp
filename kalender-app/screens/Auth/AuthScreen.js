// AuthScreen: viser login/registrering og kobler til Google-kalender etterpå
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';

import LoginForm from './login';
import SignUpForm from './signup';
import styles from '../../styles/styles';
import authScreenStyles from '../../styles/authScreenStyles';
import { auth, database } from '../../database/firebase';
import { safeLinkGoogleCalendar } from '../../services/googleCalendar';

const errorMessages = {
  'auth/invalid-email': 'Ugyldig e-postadresse.',
  'auth/user-disabled': 'Denne brukeren er deaktivert.',
  'auth/user-not-found': 'Fant ingen bruker med denne e-posten.',
  'auth/wrong-password': 'Feil passord. Prøv igjen.',
  'auth/email-already-in-use': 'E-posten er allerede i bruk.',
  'auth/weak-password': 'Passordet må være minst 6 tegn.',
  'permission-denied': 'Mangler tilgang til databasen. Sjekk sikkerhetsreglene.',
  'unavailable': 'Tilkobling til databasen feilet. Sjekk nettverk eller prøv igjen.',
};

const mapAuthError = (code, fallback = 'Noe gikk galt. Prøv igjen senere.') =>
  errorMessages[code] || fallback;

const sanitizeUsernameInput = (value) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_');

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Bytter tittel avhengig av om vi er i login- eller signup-modus
  const title = useMemo(
    () => (mode === 'login' ? 'Velkommen tilbake' : 'Kom i gang'),
    [mode]
  );

  const resetErrorAndSwitch = (nextMode) => {
    setError('');
    setMode(nextMode);
  };

  const handleLogin = async ({ email, password }) => {
    // Logger inn, og hvis bruker ikke har Google-token tilbyr vi kobling
    try {
      setLoading(true);
      setError('');

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const current = cred.user;

      if (current) {
        const tokenSnap = await get(ref(database, `calendarTokens/${current.uid}`));
        if (!tokenSnap.exists()) {
          await safeLinkGoogleCalendar(current);
        }
      }
    } catch (err) {
      console.log('Login failed', err);
      setError(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async ({ email, username, password, confirmPassword }) => {
    if (password !== confirmPassword) {
      setError('Passordene må være like.');
      return;
    }

    // Oppretter bruker, lagrer profil og kobler til Google-kalender
    try {
      setLoading(true);
      setError('');

      const trimmedUsername = (username || '').trim();
      const usernameLower = sanitizeUsernameInput(trimmedUsername);

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const current = cred.user;
      if (!current) {
        throw new Error('Fant ikke bruker etter registrering.');
      }

      const emailFallback = sanitizeUsernameInput(email.split('@')[0]);
      const baseUsername =
        usernameLower || emailFallback || `bruker_${Date.now().toString(36)}`;

      let finalUsername = baseUsername;
      let attempt = 0;
      while (attempt < 5) {
        const snapshot = await get(ref(database, `usernameIndex/${finalUsername}`));
        if (!snapshot.exists()) {
          break;
        }
        attempt += 1;
        finalUsername = `${baseUsername}_${attempt + 1}`;
      }
      if (attempt >= 5) {
        finalUsername = `${baseUsername}_${Date.now().toString(36)}`;
      }

      const displayName = trimmedUsername || finalUsername;

      await Promise.all([
        updateProfile(current, { displayName }).catch(() => undefined),
        set(ref(database, `usernames/${current.uid}`), {
          uid: current.uid,
          username: displayName,
          username_lower: finalUsername,
          email,
          createdAt: Date.now(),
        }),
        set(ref(database, `usernameIndex/${finalUsername}`), current.uid),
      ]);

      await safeLinkGoogleCalendar(current);
    } catch (err) {
      console.error('Sign up failed', err);
      setError(mapAuthError(err.code, err.message || 'Noe gikk galt.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screenContainer, authScreenStyles.container]} edges={['top', 'left', 'right']}>
      <Text style={authScreenStyles.subtitle}>{title}</Text>

      {mode === 'login' ? (
        <LoginForm
          onSubmit={handleLogin}
          goToSignUp={() => resetErrorAndSwitch('signup')}
          loading={loading}
          error={error}
        />
      ) : (
        <SignUpForm
          onSubmit={handleSignUp}
          goToLogin={() => resetErrorAndSwitch('login')}
          loading={loading}
          error={error}
        />
      )}

      <Text style={authScreenStyles.helperText}>
        Bruk e-post og passord for å logge inn. Du kan endre dette senere i Firebase.
      </Text>
    </SafeAreaView>
  );
}
