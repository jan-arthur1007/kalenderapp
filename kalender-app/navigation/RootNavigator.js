import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import MainTabs from './MainTabs';
import AppointmentDetails from '../screens/Appointment_details';
import AuthScreen from '../screens/AuthScreen';
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
  const headerTitle = useMemo(() => 'Kalender', []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      {user ? (
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
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
