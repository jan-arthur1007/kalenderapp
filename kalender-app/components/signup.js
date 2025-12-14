import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, ActivityIndicator } from 'react-native';
import styles from '../styles/styles';
import signupStyles from '../styles/signupStyles';

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
    <View style={signupStyles.container}>
      <Text style={styles.screenTitle}>Opprett konto</Text>

      <TextInput
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="E-post"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, signupStyles.field]}
      />

      <TextInput
        autoCapitalize="none"
        autoComplete="username"
        placeholder="Brukernavn"
        value={username}
        onChangeText={setUsername}
        style={[styles.input, signupStyles.field]}
      />

      <TextInput
        secureTextEntry
        placeholder="Passord (minst 6 tegn)"
        value={password}
        onChangeText={setPassword}
        style={[styles.input, signupStyles.field]}
      />

      <TextInput
        secureTextEntry
        placeholder="Bekreft passord"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={[styles.input, signupStyles.field]}
      />

      {passwordMismatch ? (
        <Text style={signupStyles.error}>Passordene må være like.</Text>
      ) : null}

      {error ? <Text style={signupStyles.error}>{error}</Text> : null}

      <Button
        title={loading ? 'Oppretter…' : 'Registrer deg'}
        onPress={handleSubmit}
        disabled={disableSubmit}
      />

      {loading ? (
        <ActivityIndicator style={signupStyles.loading} />
      ) : (
        <TouchableOpacity style={signupStyles.switchLink} onPress={goToLogin}>
          <Text style={signupStyles.switchText}>Har du allerede konto? Logg inn.</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
