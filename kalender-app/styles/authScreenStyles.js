import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#4b5563',
    marginBottom: 24,
  },
  helperText: {
    marginTop: 36,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
  },
  loadingColor: {
    color: colors.primary,
  },
});
