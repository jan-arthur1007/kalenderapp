## KalenderApp – React Native (Expo)

Dette er en videreutviklet kalender-applikasjon bygget i React Native (Expo) hvor brukere kan logge inn, legge til venner, lage grupper og opprette avtaler med medlemmene i gruppen.
Appen er koblet til Firebase Authentication for innlogging og Firestore for lagring av brukere, venner, grupper og avtaler.

Niklas har hatt hovedansvar for utviklingen av autentiserings- og profilsystemet, inkludert AuthScreen, Signup og Login, som håndterer registrering og innlogging av brukere via Firebase Authentication. Han har også kodet ProfileScreen, som viser brukerens e-post og brukernavn hentet fra databasen.

Jan Arthur har hatt hovedansvar for utviklingen av de sosiale funksjonene i applikasjonen, inkludert FriendsScreen, CreateGroupScreen og GroupDetailsScreen, hvor brukerne kan søke etter venner, legge dem til, og samle dem i grupper. I tillegg har han implementert logikken for MakeAppointment og opprettelse av avtaler knyttet til grupper. Begge har samarbeidet tett om implementeringen av Firebase Firestore og datamodellen som knytter sammen brukere, venner og grupper for å sikre en sømløs helhet i applikasjonen.

## Hvordan appen fungerer

Etter innlogging føres brukeren til hovednavigasjonen som består av faner nederst i appen (tab-navigator).
Fra her kan man:
- søke etter og legge til venner
- opprette en gruppe med valgte venner
- lage nye avtaler knyttet til gruppen
- vise detaljer om hver avtale
- se sin egen profil med e-post og brukernavn

Alle data lagres i Firestore slik at venner, grupper og avtaler er tilgjengelig også etter at appen lukkes.

Navigasjonen er bygget som en kombinasjon av stack- og tab-navigasjon, der Home viser oversikt, mens detaljsider åpnes som egne views.

## Demo‑video

Lenke til demo‑video: https://www.loom.com/share/5ff1777baf4b41a7a49e2482e855281d?sid=176343d6-b32a-4dbb-b67b-cb28cb717ac3

## Struktur

- App.js – NavigationContainer med Stack + Tabs og delt state
- components/login.js og signup.js – Registrering og innlogging via Firebase
- screens/FriendsScreen.js – Søk etter brukere og legg til venner
- screens/CreateGroupScreen.js – Opprett nye grupper med venner
- screens/GroupDetailsScreen.js – Vis gruppemedlemmer og tilhørende avtaler
- screens/MakeAppointment.js – Skjema for å lage ny avtale
- screens/Appointment_details.js – Viser detaljer for en valgt avtale
- screens/ProfileScreen.js – Viser e-post og brukernavn
- database/firebase.js – Firebase-konfigurasjon og databasekobling
- styles/styles.js – Felles styling

## Notater

- Skjemaet i MakeAppointment lagrer avtalen i databasen og oppdaterer listen på Home.
- Brukerdata og relasjoner synkroniseres automatisk via Firestore.


## GitHub link
link til GitHub repo: https://github.com/jan-arthur1007/gk1/tree/godkendelsesoppgave-2






