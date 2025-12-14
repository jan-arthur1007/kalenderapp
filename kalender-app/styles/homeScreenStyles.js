import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  safeArea: {
    paddingTop: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 26,
    letterSpacing: 0.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  busyCard: {
    marginBottom: 16,
  },
  refreshButton: {
    marginTop: 12,
  },
  refreshText: {
    color: colors.subtext,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 18,
    color: colors.text,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    columnGap: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  busySpinner: {
    marginTop: 12,
  },
  busyError: {
    color: '#dc2626',
  },
  busyRow: {
    marginTop: 8,
  },
  busyRowFirst: {
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});
