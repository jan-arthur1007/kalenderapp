// Felles styling for appen. Her samler vi farger og stilregler
// slik at komponentene blir mer konsise og enkle å vedlikeholde.
import { StyleSheet } from 'react-native';

// Fargepalett brukt gjennom appen
const colors = {
  bg: '#f7f7fb', // lys bakgrunn
  card: '#ffffff', // kort/innhold-bakgrunn
  text: '#1f2937', // primær tekst
  subtext: '#6b7280', // sekundær tekst
  primary: '#2563eb', // aksentfarge (ikke mye brukt her ennå)
  border: '#e5e7eb', // tynne linjer/rammer
};

export default StyleSheet.create({
  // Rotcontainer (brukes i noen skjermer)
  appContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Generell skjermcontainer med padding
  screenContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.bg,
  },

  // Store seksjonstitler
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },

  // Tekst som vises når en liste er tom
  emptyText: {
    textAlign: 'center',
    color: colors.subtext,
  },

  // Kort i listevisning (avtaler)
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Topp-rad i kortet med tittel og dato til høyre
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardDate: {
    fontSize: 12,
    color: colors.subtext,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.subtext,
  },

  // Skjemafelter
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: colors.subtext,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    color: colors.text,
  },

  // Rader i detaljvisningen
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    width: 100, // fast bredde for å lage kolonne
    color: colors.subtext,
    fontWeight: '600',
    marginRight: 6,
  },
  detailValue: {
    flex: 1,
    color: colors.text,
  },
});
