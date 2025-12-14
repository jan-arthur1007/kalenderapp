import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  safeArea: {
    paddingTop: 12,
  },
  tabRow: {
    flexDirection: 'row',
    columnGap: 16,
    marginBottom: 16,
  },
  tabText: {
    color: '#6b7280',
    fontWeight: '500',
    paddingBottom: 4,
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginRight: 12,
  },
  resultMessage: {
    marginTop: 8,
    color: '#6b7280',
  },
  resultCard: {
    marginTop: 12,
  },
  suggestionBlock: {
    marginTop: 12,
  },
  feedback: {
    marginTop: 8,
    color: colors.primary,
  },
  requestsContainer: {
    flex: 1,
    marginTop: 12,
  },
  requestActions: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  groupsContainer: {
    flex: 1,
    marginTop: 12,
  },
  groupsList: {
    marginTop: 12,
  },
});
