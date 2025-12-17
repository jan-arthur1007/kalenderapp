// Skjerm for å opprette en ny avtale og eventuelt knytte den til en gruppe.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  Modal,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import styles, { colors } from '../styles/styles';
import { localStyles } from '../styles/makeAppointmentStyles';
import makeAppointmentScreenStyles from '../styles/makeAppointmentScreenStyles';
import { fetchGroupFreeBusy } from '../services/freeBusy';
import { createCalendarEvent } from '../services/calendarEvents';
import { ref, update } from 'firebase/database';
import { database } from '../database/firebase';
import { auth } from '../database/firebase';

// Formaterer datetime til YYYY-MM-DD HH:MM (for visning)
const formatDateTimeForDisplay = (date) =>
  date.toLocaleString('no-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Brukes til å vise valgt tidsrom som tekst
const buildRangeLabel = (startDate, endDate) =>
  `${formatDateTimeForDisplay(startDate)} - ${formatDateTimeForDisplay(endDate)}`;

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

// Sikrer at vi starter på nærmeste minutter og ikke har sekunder
const createInitialStart = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
};

// Begrens visning og forslag til arbeidstid
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 22;

const clampSlotToWorkHours = (slot) => {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const clampedStart = new Date(start);
  const clampedEnd = new Date(end);

  if (clampedStart.getHours() < WORK_START_HOUR) {
    clampedStart.setHours(WORK_START_HOUR, 0, 0, 0);
  }
  if (clampedEnd.getHours() > WORK_END_HOUR) {
    clampedEnd.setHours(WORK_END_HOUR, 0, 0, 0);
  }

  if (clampedStart >= clampedEnd) return null;
  return { start: clampedStart, end: clampedEnd };
};

// Hjelper til med å hoppe frem 30 min (default varighet)
const thirtyMinutesFrom = (date) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 30);
  return next;
};

// Gjenbrukbar komponent for å plukke dato og tid (iOS/Android)
function DateTimeWheelField({ label, value, onChange, minimumDate, mode = 'datetime' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [pendingDate, setPendingDate] = useState(value);

  const openPicker = () => {
    const initial = minimumDate && value < minimumDate ? minimumDate : value;
    setPendingDate(initial);
    setIsVisible(true);
  };

  const closePicker = () => {
    setIsVisible(false);
  };

  const handleConfirm = (selectedDate) => {
    const baseDate = selectedDate || value;
    const withMinimum =
      minimumDate && baseDate < minimumDate ? new Date(minimumDate) : baseDate;
    onChange(new Date(withMinimum));
    setIsVisible(false);
  };

  const onPickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        closePicker();
        return;
      }
      handleConfirm(selectedDate || value);
    } else {
      setPendingDate(selectedDate || pendingDate);
    }
  };

  return (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.input, localStyles.selectInput]}
        onPress={openPicker}
      >
        <Text style={localStyles.selectValue}>{formatDateTimeForDisplay(value)}</Text>
      </TouchableOpacity>

      {isVisible && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          minimumDate={minimumDate}
          onChange={onPickerChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={isVisible}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={localStyles.modalBackdrop}>
            <View style={localStyles.modalCard}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>{label}</Text>
                <Button title="Ferdig" onPress={() => handleConfirm(pendingDate)} />
              </View>
              <DateTimePicker
                value={pendingDate}
                mode={mode}
                display="spinner"
                minimumDate={minimumDate}
                onChange={onPickerChange}
                style={localStyles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function MakeAppointment({ navigation, addAppointment, groups = [] }) {
  // Lokale felter for skjemaet
  const [title, setTitle] = useState('');
  const [startDateTime, setStartDateTime] = useState(() => createInitialStart());
  const [endDateTime, setEndDateTime] = useState(() => thirtyMinutesFrom(createInitialStart()));
  const [description, setDescription] = useState('');
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [missingMembers, setMissingMembers] = useState([]);
  const [windowStart, setWindowStart] = useState(() => startOfDay());
  const [windowEnd, setWindowEnd] = useState(() => endOfDay(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedSlotLabel, setSelectedSlotLabel] = useState('');
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDays, setCustomDays] = useState(0);
  const [customHours, setCustomHours] = useState(1);
  const [customMinutes, setCustomMinutes] = useState(0);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [slotPickerRange, setSlotPickerRange] = useState(null);
  const [slotPickerDate, setSlotPickerDate] = useState(new Date());

  // Holder gruppeseleksjon i sync med listen vi mottar som prop
  useEffect(() => {
    if (!Array.isArray(groups) || !groups.length) {
      setSelectedGroupId(null);
      return;
    }
    setSelectedGroupId((prev) => (prev && groups.some((group) => group.id === prev) ? prev : null));
    setSuggestions([]);
    setSuggestionsError('');
    setMissingMembers([]);
    setSelectedSlotLabel('');
  }, [groups]);

  // Henter valgt gruppe for enkel tilgang
  const selectedGroup = Array.isArray(groups)
    ? groups.find((group) => group.id === selectedGroupId)
    : null;

  const effectiveDuration = () => {
    if (useCustomDuration) {
      const minutes =
        customDays * 24 * 60 + customHours * 60 + customMinutes;
      if (Number.isFinite(minutes) && minutes > 0) return minutes;
    }
    return durationMinutes;
  };

  // Validerer og lagrer ny avtale
  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Manglende felt', 'Tittel må fylles ut.');
      return;
    }

    if (endDateTime <= startDateTime) {
      Alert.alert('Ugyldig periode', 'Sluttidspunkt må være etter starttidspunkt.');
      return;
    }

    if (!selectedSlotLabel) {
      Alert.alert('Ingen tidspunkt', 'Velg en foreslått tid før du lagrer avtalen.');
      return;
    }

    const item = {
      title: title.trim(),
      date: buildRangeLabel(startDateTime, endDateTime),
      startsAt: startDateTime.toISOString(),
      endsAt: endDateTime.toISOString(),
      groupId: selectedGroup?.id ?? null,
      groupName: selectedGroup?.name ?? null,
      // Deltakere registreres som kommaseparert tekst og gjøres om til array
      // Deltagerfelt lar bruker skrive manuelle navn i tillegg til gruppen
      description: description.trim(),
    };

    if (typeof addAppointment === 'function') {
      try {
        setSaving(true);
        const appointmentId = await addAppointment(item);
        // Forsøk å legge avtalen i Google-kalender for alle deltakere (best effort)
        const current = auth.currentUser;
        if (appointmentId && current) {
          createCalendarEvent({
            appointmentId,
            title: item.title,
            description: item.description,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            groupId: item.groupId,
          })
            .then(async (resp) => {
              if (resp?.eventId) {
                const updates = {
                  [`appointments/${current.uid}/${appointmentId}/googleEventId`]: resp.eventId,
                };
                await update(ref(database), updates);
              }
            })
            .catch((err) => {
              console.log('Kunne ikke opprette Google-event:', err);
            });
        }
        setTitle('');
        setDescription('');
        const now = createInitialStart();
        setStartDateTime(now);
        setEndDateTime(thirtyMinutesFrom(now));
        navigation.navigate('Home');
      } catch (err) {
        Alert.alert('Kunne ikke lagre', err.message || 'Prøv igjen.');
      } finally {
        setSaving(false);
      }
    } else {
      Alert.alert('Kunne ikke lagre', 'addAppointment er ikke tilgjengelig.');
    }
  };

  const handleSuggestionFetch = async () => {
    if (!selectedGroupId) {
      Alert.alert('Velg gruppe', 'Du må velge en gruppe for å hente forslag.');
      return;
    }
    const searchStart = startOfDay(windowStart).toISOString();
    const searchEnd = endOfDay(windowEnd).toISOString();
    try {
      setLoadingSuggestions(true);
      setSuggestionsError('');
      setMissingMembers([]);
      const data = await fetchGroupFreeBusy(selectedGroupId, {
        timeMin: searchStart,
        timeMax: searchEnd,
      });
      const minutes = effectiveDuration();
      const minDurationMs = minutes * 60 * 1000;
      const slots = (data.freeSlots || [])
        .map((slot) => ({
          start: new Date(slot.start),
          end: new Date(slot.end),
        }))
        .map(clampSlotToWorkHours)
        .filter(Boolean)
        .filter((slot) => slot.end - slot.start >= minDurationMs)
        .slice(0, 3);
      setSuggestions(slots);
      setMissingMembers(data.missingMembers || []);
      if (!slots.length) {
        setSuggestionsError('Fant ingen felles ledige tider i valgt periode.');
      }
    } catch (err) {
      setSuggestions([]);
      setSuggestionsError(err.message || 'Kunne ikke hente forslag.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const applySuggestion = (slot) => {
    if (!slot) return;
    const clamped = clampSlotToWorkHours(slot);
    if (!clamped) {
      setSuggestionsError('Tidsrommet er utenfor 08:00-22:00.');
      return;
    }
    const durationMs = effectiveDuration() * 60 * 1000;
    const latestStart = new Date(clamped.end.getTime() - durationMs);
    if (latestStart < clamped.start) {
      setSuggestionsError('Tidsrommet er for kort for valgt varighet.');
      return;
    }

    // Hvis intervallet er større enn varigheten, la bruker velge starttid innenfor intervallet
    if (clamped.end - clamped.start > durationMs + 5 * 60 * 1000) {
      setSlotPickerRange({ start: clamped.start, end: clamped.end });
      setSlotPickerDate(clamped.start);
      setSlotPickerVisible(true);
      return;
    }

    const start = clamped.start;
    const end = new Date(start.getTime() + durationMs);
    setStartDateTime(start);
    setEndDateTime(end);
    setSelectedSlotLabel(buildRangeLabel(start, end));
  };

  return (
    <SafeAreaView style={[styles.screenContainer, makeAppointmentScreenStyles.safeArea]} edges={['top', 'left', 'right']}>
      <ScrollView
      style={makeAppointmentScreenStyles.scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollsToTop={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={localStyles.scrollContent}
    >
      {/* Modal for egendefinert varighet */}
      {durationPickerVisible && (
        <Modal transparent animationType="fade" visible={durationPickerVisible}>
          <View style={localStyles.modalBackdrop}>
            <View style={[localStyles.modalCard, makeAppointmentScreenStyles.modalCardExtra]}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Egendefinert varighet</Text>
                <Button title="Lukk" onPress={() => setDurationPickerVisible(false)} />
              </View>
              <Text style={makeAppointmentScreenStyles.durationHint}>
                Velg dager, timer og minutter.
              </Text>
              <View style={makeAppointmentScreenStyles.wheelRow}>
                <View style={localStyles.wheelColumn}>
                  <Text style={localStyles.wheelLabel}>Dager</Text>
                  <ScrollView style={localStyles.wheelList}>
                    {Array.from({ length: 8 }).map((_, idx) => (
                      <TouchableOpacity
                        key={`day-${idx}`}
                        style={[
                          localStyles.wheelItem,
                          customDays === idx && localStyles.wheelItemActive,
                        ]}
                        onPress={() => setCustomDays(idx)}
                      >
                        <Text
                          style={[
                            localStyles.wheelText,
                            customDays === idx && localStyles.wheelTextActive,
                          ]}
                        >
                          {idx}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={localStyles.wheelColumn}>
                  <Text style={localStyles.wheelLabel}>Timer</Text>
                  <ScrollView style={localStyles.wheelList}>
                    {Array.from({ length: 24 }).map((_, idx) => (
                      <TouchableOpacity
                        key={`hour-${idx}`}
                        style={[
                          localStyles.wheelItem,
                          customHours === idx && localStyles.wheelItemActive,
                        ]}
                        onPress={() => setCustomHours(idx)}
                      >
                        <Text
                          style={[
                            localStyles.wheelText,
                            customHours === idx && localStyles.wheelTextActive,
                          ]}
                        >
                          {idx}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={localStyles.wheelColumn}>
                  <Text style={localStyles.wheelLabel}>Min</Text>
                  <ScrollView style={localStyles.wheelList}>
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((val) => (
                      <TouchableOpacity
                        key={`min-${val}`}
                        style={[
                          localStyles.wheelItem,
                          customMinutes === val && localStyles.wheelItemActive,
                        ]}
                        onPress={() => setCustomMinutes(val)}
                      >
                        <Text
                          style={[
                            localStyles.wheelText,
                            customMinutes === val && localStyles.wheelTextActive,
                          ]}
                        >
                          {val}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={makeAppointmentScreenStyles.wheelActionRow}>
                <Button title="Bruk" onPress={() => setDurationPickerVisible(false)} />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {slotPickerVisible && slotPickerRange && (
        <Modal transparent animationType="slide" visible={slotPickerVisible}>
          <View style={localStyles.modalBackdrop}>
            <View style={localStyles.modalCard}>
              <View style={localStyles.modalHeader}>
                <Text style={localStyles.modalTitle}>Velg starttid</Text>
                <Button title="Avbryt" onPress={() => setSlotPickerVisible(false)} />
              </View>
              <DateTimePicker
                value={slotPickerDate}
                mode="datetime"
                display="spinner"
                minimumDate={slotPickerRange.start}
                maximumDate={new Date(slotPickerRange.end.getTime() - effectiveDuration() * 60 * 1000)}
                onChange={(event, date) => {
                  if (Platform.OS === 'android') {
                    if (event.type === 'dismissed') {
                      setSlotPickerVisible(false);
                      return;
                    }
                    const chosen = date || slotPickerDate;
                    const start = new Date(
                      Math.min(
                        Math.max(chosen.getTime(), slotPickerRange.start.getTime()),
                        slotPickerRange.end.getTime() - effectiveDuration() * 60 * 1000
                      )
                    );
                    const end = new Date(start.getTime() + effectiveDuration() * 60 * 1000);
                    setStartDateTime(start);
                    setEndDateTime(end);
                    setSelectedSlotLabel(buildRangeLabel(start, end));
                    setSlotPickerVisible(false);
                  } else {
                    setSlotPickerDate(date || slotPickerDate);
                  }
                }}
              />
              {Platform.OS === 'ios' && (
                <View style={makeAppointmentScreenStyles.slotPickerContainer}>
                  <Button
                    title="Bruk"
                    onPress={() => {
                      const chosen = slotPickerDate || slotPickerRange.start;
                      const start = new Date(
                        Math.min(
                          Math.max(chosen.getTime(), slotPickerRange.start.getTime()),
                          slotPickerRange.end.getTime() - effectiveDuration() * 60 * 1000
                        )
                      );
                      const end = new Date(start.getTime() + effectiveDuration() * 60 * 1000);
                      setStartDateTime(start);
                      setEndDateTime(end);
                      setSelectedSlotLabel(buildRangeLabel(start, end));
                      setSlotPickerVisible(false);
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      <Text style={styles.screenTitle}>Lag ny avtale</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Tittel</Text>
        <TextInput
          placeholder="F.eks. Prosjektmøte"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Periode (dager)</Text>
        <DateTimeWheelField
          label="Fra"
          mode="date"
          value={windowStart}
          onChange={(date) => {
            const normalized = startOfDay(date);
            setWindowStart(normalized);
            if (windowEnd < normalized) {
              setWindowEnd(endOfDay(normalized));
            }
          }}
        />
        <DateTimeWheelField
          label="Til"
          mode="date"
          value={windowEnd}
          minimumDate={windowStart}
          onChange={(date) => {
            const normalized = endOfDay(date);
            setWindowEnd(normalized);
          }}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Varighet</Text>
        <View style={makeAppointmentScreenStyles.durationChipsRow}>
          {[30, 60, 90, 120].map((minutes) => (
            <TouchableOpacity
              key={minutes}
              style={[
                localStyles.durationChip,
                !useCustomDuration && durationMinutes === minutes && localStyles.durationChipActive,
              ]}
              onPress={() => {
                setUseCustomDuration(false);
                setDurationMinutes(minutes);
                setDurationPickerVisible(false);
              }}
            >
              <Text
                style={[
                  localStyles.durationChipLabel,
                  !useCustomDuration && durationMinutes === minutes && localStyles.durationChipLabelActive,
                ]}
              >
                {minutes < 60 ? `${minutes} min` : `${minutes / 60} t`}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              localStyles.durationChip,
              useCustomDuration && localStyles.durationChipActive,
            ]}
            onPress={() => {
              setUseCustomDuration(true);
              setDurationPickerVisible(true);
            }}
          >
            <Text
              style={[
                localStyles.durationChipLabel,
                useCustomDuration && localStyles.durationChipLabelActive,
              ]}
            >
              Egendefinert
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Valgfri gruppetilknytning */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Gruppe</Text>
        {Array.isArray(groups) && groups.length ? (
          <>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.input, localStyles.selectInput]}
              onPress={() => setGroupPickerVisible(true)}
            >
              <Text style={selectedGroupId ? localStyles.selectValue : localStyles.selectPlaceholder}>
                {selectedGroup ? selectedGroup.name : 'Velg gruppe'}
              </Text>
            </TouchableOpacity>
            <Modal
              visible={groupPickerVisible}
              transparent
              animationType="slide"
              onRequestClose={() => setGroupPickerVisible(false)}
            >
              <View style={localStyles.modalBackdrop}>
              <View style={localStyles.modalCard}>
                <View style={localStyles.modalHeader}>
                  <Text style={localStyles.modalTitle}>Velg gruppe</Text>
                  <Button title="Lukk" onPress={() => setGroupPickerVisible(false)} />
                </View>
                <TouchableOpacity
                  style={localStyles.optionRow}
                  onPress={() => {
                    setSelectedGroupId(null);
                    setGroupPickerVisible(false);
                  }}
                >
                  <Text style={localStyles.optionLabel}>Ingen gruppe</Text>
                </TouchableOpacity>
                {groups.map((group) => (
                  <TouchableOpacity
                    key={group.id}
                    style={localStyles.optionRow}
                    onPress={() => {
                        setSelectedGroupId(group.id);
                        setGroupPickerVisible(false);
                      }}
                    >
                      <Text style={localStyles.optionLabel}>{group.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <Text style={styles.emptyText}>Ingen grupper tilgjengelig. Opprett en under Venner.</Text>
        )}
      </View>
      {selectedGroupId ? (
        <View style={styles.formGroup}>
          <View style={makeAppointmentScreenStyles.headerRow}>
            <Text style={styles.label}>Felles ledige tider</Text>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                makeAppointmentScreenStyles.compactPrimaryButton,
                loadingSuggestions && makeAppointmentScreenStyles.disabledButton,
              ]}
              onPress={handleSuggestionFetch}
              disabled={loadingSuggestions}
            >
              <Text style={styles.primaryButtonText}>
                {loadingSuggestions ? 'Henter...' : 'Finn ledige tider'}
              </Text>
            </TouchableOpacity>
          </View>
          {missingMembers.length ? (
            <Text style={[styles.emptyText, makeAppointmentScreenStyles.missingMembersText]}>
              Mangler kalender for: {missingMembers.join(', ')}
            </Text>
          ) : null}
          {selectedSlotLabel ? (
            <Text style={[styles.emptyText, makeAppointmentScreenStyles.selectedSlotText]}>
              Valgt tidspunkt: {selectedSlotLabel}
            </Text>
          ) : null}
          {suggestionsError ? (
            <Text style={[styles.emptyText, makeAppointmentScreenStyles.suggestionErrorText]}>
              {suggestionsError}
            </Text>
          ) : null}
          {suggestions.map((slot) => (
            <TouchableOpacity
              key={`${slot.start}-${slot.end}`}
              style={localStyles.suggestionRow}
              onPress={() => applySuggestion(slot)}
            >
              <Text style={localStyles.suggestionLabel}>
                {buildRangeLabel(new Date(slot.start), new Date(slot.end))}
              </Text>
              <Text style={localStyles.suggestionAction}>Bruk</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Beskrivelse</Text>
        <TextInput
          placeholder="Kort beskrivelse"
          value={description}
          onChangeText={setDescription}
          style={[styles.input, makeAppointmentScreenStyles.descriptionInput]}
          multiline
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, saving && makeAppointmentScreenStyles.disabledButton]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>{saving ? 'Lagrer…' : 'Lagre avtale'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}
