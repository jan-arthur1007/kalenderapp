import { StyleSheet } from 'react-native';
import { colors } from './styles';

export const localStyles = StyleSheet.create({
  selectInput: {
    minHeight: 48,
    justifyContent: 'center',
  },
  selectValue: {
    fontSize: 15,
    color: colors.text,
  },
  selectPlaceholder: {
    fontSize: 15,
    color: colors.subtext,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  iosPicker: {
    backgroundColor: colors.card,
  },
  optionRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: {
    fontSize: 15,
    color: colors.text,
  },
  durationChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durationChipLabel: {
    color: colors.text,
    fontSize: 14,
  },
  durationChipLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  suggestionRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  suggestionLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  suggestionAction: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 160,
    backgroundColor: colors.bg,
  },
  wheelColumn: {
    width: 90,
    alignItems: 'center',
  },
  wheelLabel: {
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  wheelList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  wheelItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  wheelItemActive: {
    backgroundColor: '#d9eef7',
  },
  wheelText: {
    fontSize: 16,
    color: colors.text,
  },
  wheelTextActive: {
    fontWeight: '700',
    color: colors.primary,
  },
});
