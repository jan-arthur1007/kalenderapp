import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import HomeScreen from '../screens/HomeScreen';
import MakeAppointemnt from '../screens/MakeAppointemnt';
import FriendsScreen from '../screens/FriendsScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Tilpasset tab-navigator slik at App.js slipper detaljene
const Tab = createBottomTabNavigator();

const routeIcon = (name, focused) => {
  switch (name) {
    case 'Home':
      return focused ? 'home' : 'home-outline';
    case 'MakeAppointment':
      return focused ? 'calendar' : 'calendar-outline';
    case 'Friends':
      return focused ? 'people' : 'people-outline';
    case 'Profile':
      return focused ? 'person-circle' : 'person-circle-outline';
    default:
      return focused ? 'ellipse' : 'ellipse-outline';
  }
};

export default function MainTabs({ appointments, addAppointment, groups }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { height: 60, paddingBottom: 6, paddingTop: 6 },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={routeIcon(route.name, focused)} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" options={{ title: 'Hjem' }}>
        {(props) => <HomeScreen {...props} appointments={appointments} />}
      </Tab.Screen>
      <Tab.Screen name="MakeAppointment" options={{ title: 'Ny avtale' }}>
        {(props) => (
          <MakeAppointemnt
            {...props}
            addAppointment={addAppointment}
            groups={groups}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: 'Venner' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}
