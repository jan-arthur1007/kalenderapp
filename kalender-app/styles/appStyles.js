import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  loadingSpinner: {
    color: colors.primary,
  },
});
