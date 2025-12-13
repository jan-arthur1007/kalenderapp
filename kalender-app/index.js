// Inngangspunkt for Expo-appen.
// registerRootComponent sørger for at App blir riktig registrert
// uansett om du kjører i Expo Go eller en frittstående build.
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
