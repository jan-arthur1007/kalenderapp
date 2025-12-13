// Appens hovedfil: setter opp stack/tab-navigasjon og synkroniserer data mot RTDB
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();
import React, { useEffect, useState, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import styles from './styles/styles';
import { auth } from './database/firebase';
import useUserGroups from './hooks/useUserGroups';
import useUserAppointments from './hooks/useUserAppointments';
import RootNavigator from './navigation/RootNavigator';
import {
  addAppointment as addAppointmentAction,
  updateAppointment as updateAppointmentAction,
  deleteAppointment as deleteAppointmentAction,
} from './services/appointmentActions';

//WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const uid = user?.uid;
  const groups = useUserGroups(uid);
  const appointments = useUserAppointments(uid);

  const addAppointment = useMemo(
    () => (newItem) => addAppointmentAction(uid, newItem),
    [uid]
  );
  const updateAppointment = useMemo(
    () => (id, changes) => updateAppointmentAction(uid, id, changes),
    [uid]
  );
  const deleteAppointment = useMemo(
    () => (item) => deleteAppointmentAction(uid, item),
    [uid]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <SafeAreaProvider>
        <View style={[styles.screenContainer, localStyles.loadingContainer]}>
          <ActivityIndicator size="large" color="#2fad67" />
          <Text style={localStyles.loadingText}>Laster...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <RootNavigator
        user={user}
        appointments={appointments}
        groups={groups}
        addAppointment={addAppointment}
        updateAppointment={updateAppointment}
        deleteAppointment={deleteAppointment}
      />
    </SafeAreaProvider>
  );
}

const localStyles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
});
