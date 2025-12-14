import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  safeArea: {
    paddingTop: 12,
  },
  friendsLabel: {
    marginBottom: 8,
  },
  friendsList: {
    marginBottom: 16,
  },
  friendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderColor: '#e5e7eb',
  },
  friendCardChecked: {
    borderColor: colors.primary,
  },
  friendStatusText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  friendStatusTextChecked: {
    color: colors.primary,
  },
});
