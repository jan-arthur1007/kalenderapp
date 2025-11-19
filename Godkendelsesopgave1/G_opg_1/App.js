// Appens hovedfil: setter opp stack/tab-navigasjon og synkroniserer data mot RTDB
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();
import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { get, push, ref, update } from 'firebase/database';

import AppointmentDetails from './screens/Appointment_details';
import AuthScreen from './screens/AuthScreen';
import CreateGroupScreen from './screens/CreateGroupScreen';
import GroupDetailsScreen from './screens/GroupDetailsScreen';
import styles from './styles /styles';
import { auth, database } from './database/firebase';
import MainTabs from './navigation/MainTabs';
import useUserGroups from './hooks/useUserGroups';
import useUserAppointments from './hooks/useUserAppointments';

const Stack = createNativeStackNavigator();

//WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const uid = user?.uid;
  const groups = useUserGroups(uid);
  const appointments = useUserAppointments(uid);

  // Lagrer avtaler både for eier og alle gruppemedlemmer
  const addAppointment = async (newItem) => {
    if (!uid) {
      throw new Error('Ingen bruker logget inn');
    }

    const ownerRef = ref(database, `appointments/${uid}`);
    const newRef = push(ownerRef);
    const appointmentId = newRef.key;
    const createdAt = Date.now();

    const payload = {
      ...newItem,
      id: appointmentId,
      createdAt,
      ownerUid: uid,
    };

    const updates = {
      [`appointments/${uid}/${appointmentId}`]: payload,
    };

    if (newItem.groupId) {
      const membersSnap = await get(ref(database, `groups/${newItem.groupId}/members`));
      if (membersSnap.exists()) {
        const members = membersSnap.val() || {};
        Object.keys(members).forEach((memberUid) => {
          updates[`appointments/${memberUid}/${appointmentId}`] = {
            ...payload,
            sharedWithGroup: true,
          };
        });
      }
    }

    await update(ref(database), updates);
  };

  const headerTitle = useMemo(() => 'Kalender', []);

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
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={localStyles.loadingText}>Laster...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {user ? (
          <Stack.Navigator>
            <Stack.Screen name="Tabs" options={{ headerTitle }}>
              {() => (
                <MainTabs
                  appointments={appointments}
                  addAppointment={addAppointment}
                  groups={groups}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AppointmentDetails"
              component={AppointmentDetails}
              options={{ title: 'Avtaledetaljer' }}
            />
            <Stack.Screen
              name="CreateGroup"
              component={CreateGroupScreen}
              options={{ title: 'Ny gruppe' }}
            />
            <Stack.Screen
              name="GroupDetails"
              component={GroupDetailsScreen}
              options={{ title: 'Gruppe' }}
            />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
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
