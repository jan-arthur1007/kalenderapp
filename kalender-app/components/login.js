import React, { useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, ActivityIndicator } from 'react-native';
import styles from '../styles/styles';

const fieldStyle = [styles.input, { marginBottom: 12 }];

export default function LoginForm({ onSubmit, goToSignUp, loading = false, error = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!onSubmit) {
      return;
    }
    onSubmit({ email: email.trim(), password });
  };

  return (
    <View style={{ width: '100%' }}>
      <Text style={styles.screenTitle}>Logg inn</Text>

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
        secureTextEntry
        placeholder="Passord"
        value={password}
        onChangeText={setPassword}
        style={fieldStyle}
      />

      {error ? <Text style={{ color: '#dc2626', marginBottom: 12 }}>{error}</Text> : null}

      <Button
        title={loading ? 'Logger inn…' : 'Logg inn'}
        onPress={handleSubmit}
        disabled={loading || !email.trim() || !password}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <TouchableOpacity style={{ marginTop: 16 }} onPress={goToSignUp}>
          <Text style={{ textAlign: 'center', color: '#2fad67' }}>
            Har du ikke konto? Registrer deg.
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
