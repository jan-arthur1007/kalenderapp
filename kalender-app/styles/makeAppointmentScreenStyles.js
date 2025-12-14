import { StyleSheet } from 'react-native';
import { colors } from './styles';

export default StyleSheet.create({
  safeArea: {
    paddingTop: 12,
  },
  scroll: {
    flex: 1,
  },
  durationHint: {
    color: '#6b7280',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  wheelActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    marginHorizontal: 20,
  },
  slotPickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  durationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactPrimaryButton: {
    marginTop: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  missingMembersText: {
    color: '#92400e',
    marginTop: 4,
  },
  selectedSlotText: {
    color: colors.accent,
    fontWeight: '700',
    marginTop: 4,
  },
  suggestionErrorText: {
    color: '#dc2626',
    marginTop: 4,
  },
  descriptionInput: {
    height: 90,
  },
  modalCardExtra: {
    paddingBottom: 24,
  },
});
