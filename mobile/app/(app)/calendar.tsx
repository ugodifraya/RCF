import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import {
  Event, Match, AttendanceStatus,
  COLOR_KEYS, DEFAULT_COLORS, getEventColor,
} from '../../src/types';

/* ─── Types locaux ───────────────────────────────────────────────────────── */

type CalItem =
  | { kind: 'event';    data: Event }
  | { kind: 'match';    data: Match }
  | { kind: 'birthday'; data: { id: string; firstName: string; lastName: string; birthDate: string } };

type ListFilter = 'upcoming' | 'past' | 'all';

interface Colors { training: string; match: string; tournament: string; other: string }

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const DOW = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

const DEFAULT_COLORS_STATE: Colors = {
  training:   DEFAULT_COLORS.TRAINING,
  match:      DEFAULT_COLORS.MATCH,
  tournament: DEFAULT_COLORS.TOURNAMENT,
  other:      DEFAULT_COLORS.OTHER,
};

const TYPE_LABEL: Record<string, string> = {
  TRAINING: 'Entraînement', INTERNAL: 'Match entre nous', FRIENDLY: 'Match amical',
  CHAMPIONSHIP: 'Match de championnat', CUP: 'Match de coupe',
  TOURNAMENT: 'Tournoi', OTHER: 'Autre événement',
};

const ATT_STYLE: Record<AttendanceStatus, { bg: string; text: string; border: string }> = {
  PRESENT: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  ABSENT:  { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  MAYBE:   { bg: '#fefce8', text: '#a16207', border: '#fef08a' },
  PENDING: { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};

const ATT_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: '✓ Présente', ABSENT: '✗ Absente', MAYBE: '? Peut-être', PENDING: '– En attente',
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function calColor(item: CalItem, colors: Colors): string {
  if (item.kind === 'birthday') return '#f43f5e';
  if (item.kind === 'match')    return colors.match;
  return getEventColor(item.data.type, {
    [COLOR_KEYS.TRAINING]:   colors.training,
    [COLOR_KEYS.MATCH]:      colors.match,
    [COLOR_KEYS.TOURNAMENT]: colors.tournament,
    [COLOR_KEYS.OTHER]:      colors.other,
  });
}

function birthdayThisYear(birthDate: string, year: number): Date {
  const d = new Date(birthDate);
  return new Date(year, d.getMonth(), d.getDate());
}

function matchResult(m: Match) {
  if (m.scoreHome == null || m.scoreAway == null) return null;
  const ours   = m.homeAway === 'HOME' ? m.scoreHome : m.scoreAway;
  const theirs = m.homeAway === 'HOME' ? m.scoreAway : m.scoreHome;
  if (ours > theirs) return { label: 'V', bg: '#dcfce7', text: '#166534' };
  if (ours < theirs) return { label: 'D', bg: '#fee2e2', text: '#991b1b' };
  return { label: 'N', bg: '#f3f4f6', text: '#374151' };
}

/* ─── Écran principal ────────────────────────────────────────────────────── */

export default function CalendarScreen() {
  const { user, isCoach } = useAuth();

  const [events,    setEvents]    = useState<Event[]>([]);
  const [matches,   setMatches]   = useState<Match[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: string; firstName: string; lastName: string; birthDate: string }[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [colors,    setColors]    = useState<Colors>(DEFAULT_COLORS_STATE);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay,  setSelectedDay]  = useState<Date | null>(null);
  const [listFilter,   setListFilter]   = useState<ListFilter>('upcoming');
  const [viewMode,     setViewMode]     = useState<'calendar' | 'list'>('calendar');
  const today = new Date();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/events'),
      api.get('/matches'),
      api.get('/events/birthdays'),
    ]).then(([eR, mR, bR]) => {
      setEvents(eR.data);
      setMatches(mR.data);
      setBirthdays(bR.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    Promise.all([
      AsyncStorage.getItem(COLOR_KEYS.TRAINING),
      AsyncStorage.getItem(COLOR_KEYS.MATCH),
      AsyncStorage.getItem(COLOR_KEYS.TOURNAMENT),
      AsyncStorage.getItem(COLOR_KEYS.OTHER),
    ]).then(([t, m, to, o]) => setColors({
      training:   t  || DEFAULT_COLORS.TRAINING,
      match:      m  || DEFAULT_COLORS.MATCH,
      tournament: to || DEFAULT_COLORS.TOURNAMENT,
      other:      o  || DEFAULT_COLORS.OTHER,
    }));
  }, []);

  /* ── Items combinés ── */
  const allItems = useMemo<CalItem[]>(() => {
    const y = currentMonth.getFullYear();
    const evs: CalItem[]  = events.map(e => ({ kind: 'event', data: e }));
    const mts: CalItem[]  = matches.map(m => ({ kind: 'match', data: m }));
    const bds: CalItem[]  = birthdays.flatMap(b =>
      [y - 1, y, y + 1].map(yr => ({ kind: 'birthday' as const, data: { ...b, birthDate: birthdayThisYear(b.birthDate, yr).toISOString() } }))
    );
    const getDate = (i: CalItem) => i.kind === 'birthday' ? i.data.birthDate : i.data.date;
    return [...evs, ...mts, ...bds].sort((a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime());
  }, [events, matches, birthdays, currentMonth]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    allItems.forEach(item => {
      const key = format(new Date(item.kind === 'birthday' ? item.data.birthDate : item.data.date), 'yyyy-MM-dd');
      (map[key] ??= []).push(item);
    });
    return map;
  }, [allItems]);

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentMonth),   { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  const dayItems    = useMemo(() => !selectedDay ? [] : allItems.filter(i => isSameDay(new Date(i.kind === 'birthday' ? i.data.birthDate : i.data.date), selectedDay)), [allItems, selectedDay]);
  const listItems   = useMemo(() => {
    const now = new Date();
    return allItems.filter(i => {
      const d = new Date(i.kind === 'birthday' ? i.data.birthDate : i.data.date);
      if (listFilter === 'upcoming') return d >= now;
      if (listFilter === 'past')     return d < now;
      return true;
    });
  }, [allItems, listFilter]);

  /* ── Handlers ── */
  const handleAttendance = async (eventId: string, status: AttendanceStatus) => {
    await api.post(`/events/${eventId}/attendance`, { status });
    load();
  };

  const handleDeleteEvent = (id: string) =>
    Alert.alert('Supprimer', 'Supprimer cet événement ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await api.delete(`/events/${id}`); load(); } },
    ]);

  const handleDeleteMatch = (id: string) =>
    Alert.alert('Supprimer', 'Supprimer ce match ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await api.delete(`/matches/${id}`); load(); } },
    ]);

  const handleNotify = async (eventId: string) => {
    setNotifying(eventId);
    try {
      const r = await api.post(`/events/${eventId}/notify-pending`);
      Alert.alert('Relancé', `${r.data.notified} joueuse(s) relancée(s).`);
    } catch { } finally { setNotifying(null); }
  };

  const sharedProps = { user, isCoach, colors, notifying, handleAttendance, handleDeleteEvent, handleDeleteMatch, handleNotify };

  /* ── Render ── */
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Calendrier</Text>
            <Text className="text-sm text-gray-500 mt-0.5">Entraînements, matchs et anniversaires</Text>
          </View>
        </View>

        {/* Toggle */}
        <View className="mx-4 mt-2 mb-3 flex-row bg-white rounded-xl border border-gray-200 p-1 self-start">
          {(['calendar', 'list'] as const).map(v => (
            <TouchableOpacity key={v} onPress={() => setViewMode(v)} className={`px-4 py-1.5 rounded-lg ${viewMode === v ? 'bg-blue-600' : ''}`}>
              <Text className={`text-sm font-medium ${viewMode === v ? 'text-white' : 'text-gray-600'}`}>
                {v === 'calendar' ? '📅 Calendrier' : '📋 Liste'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View className="items-center py-20"><ActivityIndicator size="large" color="#2563eb" /></View>
        ) : viewMode === 'calendar' ? (
          <View className="px-4">
            {/* Navigation mois */}
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity onPress={() => { setSelectedDay(null); setCurrentMonth(m => subMonths(m, 1)); }} className="w-9 h-9 rounded-xl bg-white border border-gray-200 items-center justify-center">
                <Text className="text-gray-600 text-xl">‹</Text>
              </TouchableOpacity>
              <Text className="text-lg font-bold text-gray-900 capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</Text>
              <TouchableOpacity onPress={() => { setSelectedDay(null); setCurrentMonth(m => addMonths(m, 1)); }} className="w-9 h-9 rounded-xl bg-white border border-gray-200 items-center justify-center">
                <Text className="text-gray-600 text-xl">›</Text>
              </TouchableOpacity>
            </View>

            {/* Grille */}
            <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <View className="flex-row border-b border-gray-100">
                {DOW.map(d => (
                  <View key={d} style={{ width: `${100 / 7}%` }} className="items-center py-2">
                    <Text className="text-xs font-semibold text-gray-400">{d}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-row flex-wrap">
                {calDays.map((day, i) => {
                  const key        = format(day, 'yyyy-MM-dd');
                  const items      = itemsByDay[key] || [];
                  const isToday    = isSameDay(day, today);
                  const isSelected = !!selectedDay && isSameDay(day, selectedDay);
                  const inMonth    = isSameMonth(day, currentMonth);
                  const hasBday    = items.some(it => it.kind === 'birthday');
                  const dots       = items.filter(it => it.kind !== 'birthday');
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
                      style={{ width: `${100 / 7}%`, minHeight: 56 }}
                      className={`items-center pt-1.5 pb-1 border-b border-r border-gray-50 ${isSelected ? 'bg-blue-50' : ''} ${!inMonth ? 'opacity-30' : ''}`}
                    >
                      <View className={`w-7 h-7 rounded-full items-center justify-center mb-0.5 ${isToday ? 'bg-blue-600' : ''}`}>
                        <Text className={`text-sm ${isToday ? 'text-white font-bold' : isSelected ? 'text-blue-700 font-bold' : 'text-gray-700'}`}>
                          {format(day, 'd')}
                        </Text>
                      </View>
                      {hasBday && <Text style={{ fontSize: 9, lineHeight: 12 }}>🎂</Text>}
                      {dots.length > 0 && (
                        <View className="flex-row flex-wrap justify-center" style={{ gap: 2 }}>
                          {dots.slice(0, 3).map((it, j) => (
                            <View key={j} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: calColor(it, colors) }} />
                          ))}
                          {dots.length > 3 && <Text style={{ fontSize: 9, color: '#9ca3af' }}>+{dots.length - 3}</Text>}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Panneau jour sélectionné */}
            {selectedDay && (
              <View className="mt-3" style={{ gap: 8 }}>
                <Text className="font-semibold text-gray-700 capitalize">{format(selectedDay, 'EEEE d MMMM', { locale: fr })}</Text>
                {dayItems.length === 0
                  ? <View className="bg-white rounded-2xl border border-gray-200 py-10 items-center"><Text className="text-gray-400 text-sm">Aucun événement ce jour.</Text></View>
                  : dayItems.map((item, i) => <CalItemCard key={i} item={item} {...sharedProps} />)
                }
              </View>
            )}
          </View>
        ) : (
          /* Vue liste */
          <ListView items={listItems} filter={listFilter} onFilterChange={setListFilter} sharedProps={sharedProps} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── CalItemCard ────────────────────────────────────────────────────────── */

type SharedProps = {
  user: ReturnType<typeof useAuth>['user'];
  isCoach: boolean;
  colors: Colors;
  notifying: string | null;
  handleAttendance: (id: string, s: AttendanceStatus) => void;
  handleDeleteEvent: (id: string) => void;
  handleDeleteMatch: (id: string) => void;
  handleNotify: (id: string) => void;
};

function CalItemCard({ item, user, isCoach, colors, notifying, handleAttendance, handleDeleteEvent, handleDeleteMatch, handleNotify }: { item: CalItem } & SharedProps) {

  if (item.kind === 'birthday') {
    return (
      <View className="flex-row items-center bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3" style={{ gap: 12 }}>
        <Text style={{ fontSize: 24 }}>🎂</Text>
        <View>
          <Text className="font-semibold text-gray-900">{item.data.firstName} {item.data.lastName}</Text>
          <Text className="text-xs text-rose-400">Anniversaire</Text>
        </View>
      </View>
    );
  }

  if (item.kind === 'match') {
    const m      = item.data;
    const result = matchResult(m);
    const color  = calColor(item, colors);
    return (
      <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <View style={{ height: 4, backgroundColor: color }} />
        <View className="px-4 py-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                <Text className="font-semibold text-gray-900">vs {m.opponent}</Text>
                {result && (
                  <View style={{ backgroundColor: result.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: result.text, fontSize: 11, fontWeight: '700' }}>{result.label}</Text>
                  </View>
                )}
                <Text className="text-xs text-gray-400">{m.homeAway === 'HOME' ? '🏠' : m.homeAway === 'AWAY' ? '✈️' : '⚖️'}</Text>
              </View>
              {(m.scoreHome != null || m.scoreAway != null) && (
                <Text className="text-sm font-bold text-gray-700 mt-0.5">{m.scoreHome ?? '–'} – {m.scoreAway ?? '–'}</Text>
              )}
              <View className="flex-row flex-wrap mt-1" style={{ gap: 8 }}>
                <Text className="text-xs text-gray-400">{format(new Date(m.date), 'HH:mm')}</Text>
                {m.location    && <Text className="text-xs text-gray-400">📍 {m.location}</Text>}
                {m.competition && <Text className="text-xs text-gray-400">🏆 {m.competition}</Text>}
              </View>
            </View>
            {isCoach && (
              <View className="items-end" style={{ gap: 4 }}>
                <TouchableOpacity onPress={() => handleDeleteMatch(m.id)}>
                  <Text className="text-xs text-red-400">Supprimer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  /* Événement */
  const ev      = item.data;
  const color   = calColor(item, colors);
  const myAtt   = ev.attendances?.find(a => a.userId === user?.id);
  const pending = ev.attendances?.filter(a => a.status === 'PENDING').length ?? 0;
  const typeLabel = TYPE_LABEL[ev.subtype || ev.type] || ev.type;

  return (
    <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <View style={{ height: 4, backgroundColor: color }} />
      <View className="px-4 py-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
              <Text className="font-semibold text-gray-900 flex-shrink" numberOfLines={1}>{ev.title}</Text>
              <View style={{ backgroundColor: color, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{typeLabel}</Text>
              </View>
            </View>
            <View className="flex-row flex-wrap mt-1" style={{ gap: 8 }}>
              <Text className="text-xs text-gray-400">{format(new Date(ev.date), 'HH:mm')}</Text>
              {ev.meetingTime && <Text className="text-xs text-amber-600 font-medium">RDV {format(new Date(ev.meetingTime), 'HH:mm')}</Text>}
              {ev.location    && <Text className="text-xs text-gray-400">📍 {ev.location}</Text>}
            </View>
          </View>
          {isCoach && (
            <TouchableOpacity onPress={() => handleDeleteEvent(ev.id)}>
              <Text className="text-xs text-red-400">Supprimer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Présence — joueuse */}
        {!isCoach && myAtt && (
          <View className="mt-3 flex-row items-center flex-wrap" style={{ gap: 8 }}>
            <View style={{ backgroundColor: ATT_STYLE[myAtt.status].bg, borderColor: ATT_STYLE[myAtt.status].border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
              <Text style={{ color: ATT_STYLE[myAtt.status].text, fontSize: 11 }}>{ATT_LABEL[myAtt.status]}</Text>
            </View>
            <View className="flex-row" style={{ gap: 4 }}>
              {(['PRESENT', 'ABSENT', 'MAYBE'] as AttendanceStatus[]).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => handleAttendance(ev.id, s)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 2,
                    backgroundColor: myAtt.status === s ? color : 'transparent',
                    borderColor: myAtt.status === s ? color : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: myAtt.status === s ? '#fff' : '#9ca3af', fontSize: 12, fontWeight: '600' }}>
                    {s === 'PRESENT' ? '✓' : s === 'ABSENT' ? '✗' : '?'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Relancer — coach */}
        {isCoach && pending > 0 && (
          <TouchableOpacity className="mt-2" onPress={() => handleNotify(ev.id)} disabled={notifying === ev.id}>
            <Text className="text-xs text-amber-600 font-medium">
              {notifying === ev.id ? 'Envoi...' : `🔔 Relancer ${pending} sans réponse`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── ListView ───────────────────────────────────────────────────────────── */

function ListView({ items, filter, onFilterChange, sharedProps }: {
  items: CalItem[];
  filter: ListFilter;
  onFilterChange: (f: ListFilter) => void;
  sharedProps: SharedProps;
}) {
  const grouped = useMemo(() => {
    const map: { key: string; label: string; items: CalItem[] }[] = [];
    const seen: Record<string, number> = {};
    for (const item of items) {
      const raw = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      const key = format(new Date(raw), 'yyyy-MM-dd');
      if (seen[key] == null) { seen[key] = map.length; map.push({ key, label: format(new Date(raw), 'EEEE d MMMM yyyy', { locale: fr }), items: [] }); }
      map[seen[key]].items.push(item);
    }
    return map;
  }, [items]);

  return (
    <View className="px-4">
      <View className="flex-row bg-white rounded-xl border border-gray-200 p-1 self-start mb-4">
        {(['upcoming', 'past', 'all'] as ListFilter[]).map(v => (
          <TouchableOpacity key={v} onPress={() => onFilterChange(v)} className={`px-4 py-1.5 rounded-lg ${filter === v ? 'bg-blue-600' : ''}`}>
            <Text className={`text-sm font-medium ${filter === v ? 'text-white' : 'text-gray-600'}`}>
              {v === 'upcoming' ? 'À venir' : v === 'past' ? 'Passés' : 'Tous'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {grouped.length === 0 ? (
        <View className="bg-white rounded-2xl border border-gray-200 py-12 items-center">
          <Text className="text-3xl mb-2">📅</Text>
          <Text className="text-gray-400 text-sm">{filter === 'upcoming' ? 'Aucun événement à venir' : filter === 'past' ? 'Aucun événement passé' : 'Aucun événement'}</Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {grouped.map(({ key, label, items: gItems }) => (
            <View key={key} style={{ gap: 8 }}>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">{label}</Text>
              {gItems.map((item, i) => <CalItemCard key={i} item={item} {...sharedProps} />)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
