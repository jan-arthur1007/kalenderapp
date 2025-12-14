import React, { useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, ActivityIndicator } from 'react-native';
import styles from '../styles/styles';
import loginStyles from '../styles/loginStyles';

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
    <View style={loginStyles.container}>
      <Text style={styles.screenTitle}>Logg inn</Text>

      <TextInput
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="E-post"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, loginStyles.field]}
      />

      <TextInput
        secureTextEntry
        placeholder="Passord"
        value={password}
        onChangeText={setPassword}
        style={[styles.input, loginStyles.field]}
      />

      {error ? <Text style={loginStyles.error}>{error}</Text> : null}

      <Button
        title={loading ? 'Logger inn…' : 'Logg inn'}
        onPress={handleSubmit}
        disabled={loading || !email.trim() || !password}
      />

      {loading ? (
        <ActivityIndicator style={loginStyles.loading} />
      ) : (
        <TouchableOpacity style={loginStyles.switchLink} onPress={goToSignUp}>
          <Text style={loginStyles.switchText}>Har du ikke konto? Registrer deg.</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
