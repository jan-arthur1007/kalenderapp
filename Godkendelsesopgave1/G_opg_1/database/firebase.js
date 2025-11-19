import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyC8f_sKtw6NmyXqpjMfpDiFwDVZWPUjo_g",
  authDomain: "kalender-app-56045.firebaseapp.com",
  projectId: "kalender-app-56045",
  storageBucket: "kalender-app-56045.firebasestorage.app",
  messagingSenderId: "243968150095",
  appId: "1:243968150095:web:9e402b6c6f9edd80e5783a"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const database = getDatabase(
  app,
  'https://kalender-app-56045-default-rtdb.europe-west1.firebasedatabase.app/'
);

export { auth, db, database };
