import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, ActivityIndicator } from 'react-native';
import styles from '../styles/styles';

const fieldStyle = [styles.input, { marginBottom: 12 }];

export default function SignUpForm({ onSubmit, goToLogin, loading = false, error = '' }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = () => {
    if (!onSubmit) {
      return;
    }
    onSubmit({ email: email.trim(), username: username.trim(), password, confirmPassword });
  };

  const passwordMismatch = useMemo(
    () => confirmPassword.length > 0 && password !== confirmPassword,
    [password, confirmPassword]
  );

  const disableSubmit =
    loading || !email.trim() || !username.trim() || password.length < 6 || passwordMismatch;

  return (
    <View style={{ width: '100%' }}>
      <Text style={styles.screenTitle}>Opprett konto</Text>

      <TextInput
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="E-post"
        value={email}
        onChangeText={setEmail}
        style={fieldStyle}
      />

      <TextInput
        autoCapitalize="none"
        autoComplete="username"
        placeholder="Brukernavn"
        value={username}
        onChangeText={setUsername}
        style={fieldStyle}
      />

      <TextInput
        secureTextEntry
        placeholder="Passord (minst 6 tegn)"
        value={password}
        onChangeText={setPassword}
        style={fieldStyle}
      />

      <TextInput
        secureTextEntry
        placeholder="Bekreft passord"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={fieldStyle}
      />

      {passwordMismatch ? (
        <Text style={{ color: '#dc2626', marginBottom: 12 }}>Passordene må være like.</Text>
      ) : null}

      {error ? <Text style={{ color: '#dc2626', marginBottom: 12 }}>{error}</Text> : null}

      <Button
        title={loading ? 'Oppretter…' : 'Registrer deg'}
        onPress={handleSubmit}
        disabled={disableSubmit}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <TouchableOpacity style={{ marginTop: 16 }} onPress={goToLogin}>
          <Text style={{ textAlign: 'center', color: '#2fad67' }}>
            Har du allerede konto? Logg inn.
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
