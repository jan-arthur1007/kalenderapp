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
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import styles from '../styles /styles';

// Formaterer datetime til YYYY-MM-DD HH:MM (for visning)
const formatDateTimeForDisplay = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

// Brukes til å vise valgt tidsrom som tekst
const buildRangeLabel = (startDate, endDate) =>
  `${formatDateTimeForDisplay(startDate)} - ${formatDateTimeForDisplay(endDate)}`;

// Sikrer at vi starter på nærmeste minutter og ikke har sekunder
const createInitialStart = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
};

// Hjelper til med å hoppe frem 30 min (default varighet)
const thirtyMinutesFrom = (date) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 30);
  return next;
};

// Gjenbrukbar komponent for å plukke dato og tid (iOS/Android)
function DateTimeWheelField({
  label,
  value,
  onChange,
  minimumDate,
}) {
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
          mode="datetime"
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
                mode="datetime"
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

export default function MakeAppointemnt({ navigation, addAppointment, groups = [] }) {
  // Lokale felter for skjemaet
  const [title, setTitle] = useState('');
  const [startDateTime, setStartDateTime] = useState(() => createInitialStart());
  const [endDateTime, setEndDateTime] = useState(() => thirtyMinutesFrom(createInitialStart()));
  const [participants, setParticipants] = useState('');
  const [description, setDescription] = useState('');
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Holder gruppeseleksjon i sync med listen vi mottar som prop
  useEffect(() => {
    if (!Array.isArray(groups) || !groups.length) {
      setSelectedGroupId(null);
      return;
    }
    setSelectedGroupId((prev) => (prev && groups.some((group) => group.id === prev) ? prev : null));
  }, [groups]);

  // Henter valgt gruppe for enkel tilgang
  const selectedGroup = Array.isArray(groups)
    ? groups.find((group) => group.id === selectedGroupId)
    : null;

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

    const item = {
      title: title.trim(),
      date: buildRangeLabel(startDateTime, endDateTime),
      startsAt: startDateTime.toISOString(),
      endsAt: endDateTime.toISOString(),
      groupId: selectedGroup?.id ?? null,
      groupName: selectedGroup?.name ?? null,
      // Deltakere registreres som kommaseparert tekst og gjøres om til array
      // Deltagerfelt lar bruker skrive manuelle navn i tillegg til gruppen
      participants: participants
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      description: description.trim(),
    };

    if (typeof addAppointment === 'function') {
      try {
        setSaving(true);
        await addAppointment(item);
        setTitle('');
        setParticipants('');
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

  return (
    <View style={styles.screenContainer}>
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
        <Text style={styles.label}>Periode</Text>
        <DateTimeWheelField
          label="Start"
          value={startDateTime}
          onChange={(date) => {
            setStartDateTime(date);
            if (date >= endDateTime) {
              setEndDateTime(thirtyMinutesFrom(date));
            }
          }}
        />
        <DateTimeWheelField
          label="Slutt"
          value={endDateTime}
          minimumDate={startDateTime}
          onChange={(date) => {
            if (date <= startDateTime) {
              setEndDateTime(thirtyMinutesFrom(startDateTime));
            } else {
              setEndDateTime(date);
            }
          }}
        />
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

      <View style={styles.formGroup}>
        <Text style={styles.label}>Deltakere (kommaseparert)</Text>
        <TextInput
          placeholder="Anna, Jonas, ..."
          value={participants}
          onChangeText={setParticipants}
          style={styles.input}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Beskrivelse</Text>
        <TextInput
          placeholder="Kort beskrivelse"
          value={description}
          onChangeText={setDescription}
          style={[styles.input, { height: 90 }]}
          multiline
        />
      </View>

      <Button title={saving ? 'Lagrer…' : 'Lagre avtale'} onPress={onSave} disabled={saving} />
    </View>
  );
}

const localStyles = StyleSheet.create({
  selectInput: {
    minHeight: 48,
    justifyContent: 'center',
  },
  selectValue: {
    fontSize: 15,
    color: '#1f2937',
  },
  selectPlaceholder: {
    fontSize: 15,
    color: '#9ca3af',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
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
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  iosPicker: {
    backgroundColor: '#ffffff',
  },
  optionRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionLabel: {
    fontSize: 15,
    color: '#1f2937',
  },
});
