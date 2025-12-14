import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  container: {
    width: '100%',
  },
  field: {
    marginBottom: 12,
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
  },
  loading: {
    marginTop: 12,
  },
  switchLink: {
    marginTop: 16,
  },
  switchText: {
    textAlign: 'center',
    color: colors.primary,
  },
});
