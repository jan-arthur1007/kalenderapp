import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import MainTabs from './MainTabs';
import AppointmentDetails from '../screens/Appointment_details';
import AuthScreen from '../screens/Auth/AuthScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailsScreen from '../screens/GroupDetailsScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator({
  user,
  appointments,
  groups,
  addAppointment,
  updateAppointment,
  deleteAppointment,
}) {
  // Fast header-tittel for screens som viser header
  const headerTitle = useMemo(() => 'Kalender', []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {user ? (
        // Innlogget: viser tab-navigasjon + detaljerte stack-screens
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" options={{ headerTitle }}>
            {() => (
              <MainTabs
                appointments={appointments}
                addAppointment={addAppointment}
                updateAppointment={updateAppointment}
                deleteAppointment={deleteAppointment}
                groups={groups}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="AppointmentDetails"
            component={AppointmentDetails}
            options={{ title: 'Avtaledetaljer', headerShown: true }}
          />
          <Stack.Screen
            name="CreateGroup"
            component={CreateGroupScreen}
            options={{ title: 'Ny gruppe', headerShown: true }}
          />
          <Stack.Screen
            name="GroupDetails"
            component={GroupDetailsScreen}
            options={{ title: 'Gruppe', headerShown: true }}
          />
        </Stack.Navigator>
      ) : (
        // Utlogget: viser bare auth-flow
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
