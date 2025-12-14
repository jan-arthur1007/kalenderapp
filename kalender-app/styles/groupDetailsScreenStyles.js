import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingColor: {
    color: colors.primary,
  },
  rowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeText: {
    color: '#dc2626',
  },
  mutedText: {
    color: '#9ca3af',
  },
  addFriendsSection: {
    marginTop: 16,
  },
  statusText: {
    color: '#9ca3af',
  },
  statusTextChecked: {
    color: colors.primary,
  },
  actionsContainer: {
    marginTop: 24,
  },
  deleteContainer: {
    marginTop: 12,
  },
});
