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
  safeArea: {
    paddingTop: 12,
  },
  googleButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  googleButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  profileValueBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  profileValueText: {
    color: '#1f2937',
  },
});
