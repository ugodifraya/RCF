import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import {
  Event, Match,
  COLOR_KEYS, DEFAULT_COLORS, getEventColor,
} from '../../src/types';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isSameMonth,
} from 'date-fns';
import { fr } from 'date-fns/locale';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type CalItem =
  | { kind: 'event'; data: Event }
  | { kind: 'match'; data: Match }
  | { kind: 'birthday'; data: { id: string; firstName: string; lastName: string; birthDate: string } };

type ViewMode = 'calendar' | 'list';
type ListFilter = 'upcoming' | 'past' | 'all';

export type EventSubtype =
  | 'TRAINING' | 'INTERNAL' | 'FRIENDLY'
  | 'CHAMPIONSHIP' | 'CUP' | 'TOURNAMENT' | 'OTHER';

interface Colors {
  training: string;
  match: string;
  tournament: string;
  other: string;
}

/* ─── Constantes ─────────────────────────────────────────────────────────── */

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const DEFAULT_COLOR_STATE: Colors = {
  training:   DEFAULT_COLORS.TRAINING,
  match:      DEFAULT_COLORS.MATCH,
  tournament: DEFAULT_COLORS.TOURNAMENT,
  other:      DEFAULT_COLORS.OTHER,
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function itemColor(item: CalItem, colors: Colors): string {
  if (item.kind === 'birthday') return '#f43f5e';
  if (item.kind === 'match') return colors.match;
  const colorsMap: Record<string, string> = {
    [COLOR_KEYS.TRAINING]:   colors.training,
    [COLOR_KEYS.MATCH]:      colors.match,
    [COLOR_KEYS.TOURNAMENT]: colors.tournament,
    [COLOR_KEYS.OTHER]:      colors.other,
  };
  return getEventColor(item.data.type, colorsMap);
}

function birthdayDateForYear(birthDate: string, year: number): Date {
  const d = new Date(birthDate);
  return new Date(year, d.getMonth(), d.getDate());
}

async function loadColors(): Promise<Colors> {
  const [training, match, tournament, other] = await Promise.all([
    AsyncStorage.getItem(COLOR_KEYS.TRAINING),
    AsyncStorage.getItem(COLOR_KEYS.MATCH),
    AsyncStorage.getItem(COLOR_KEYS.TOURNAMENT),
    AsyncStorage.getItem(COLOR_KEYS.OTHER),
  ]);
  return {
    training:   training   || DEFAULT_COLORS.TRAINING,
    match:      match      || DEFAULT_COLORS.MATCH,
    tournament: tournament || DEFAULT_COLORS.TOURNAMENT,
    other:      other      || DEFAULT_COLORS.OTHER,
  };
}

/* ─── Composant principal ────────────────────────────────────────────────── */

export default function CalendarScreen() {
  const { isCoach } = useAuth();

  const [events, setEvents]       = useState<Event[]>([]);
  const [matches, setMatches]     = useState<Match[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: string; firstName: string; lastName: string; birthDate: string }[]>([]);
  const [loading, setLoading]     = useState(true);

  const [viewMode, setViewMode]         = useState<ViewMode>('calendar');
  const [listFilter, setListFilter]     = useState<ListFilter>('upcoming');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay]   = useState<Date | null>(null);
  const [colors, setColors]             = useState<Colors>(DEFAULT_COLOR_STATE);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/events'),
      api.get('/matches'),
      api.get('/events/birthdays'),
    ]).then(([eRes, mRes, bRes]) => {
      setEvents(eRes.data);
      setMatches(mRes.data);
      setBirthdays(bRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadColors().then(setColors);
  }, []);

  const allItems: CalItem[] = useMemo(() => {
    const year     = currentMonth.getFullYear();
    const prevYear = year - 1;
    const nextYear = year + 1;

    const evItems: CalItem[] = events.map(e => ({ kind: 'event', data: e }));
    const mItems: CalItem[]  = matches.map(m => ({ kind: 'match', data: m }));

    const bItems: CalItem[] = [];
    for (const b of birthdays) {
      for (const y of [prevYear, year, nextYear]) {
        bItems.push({
          kind: 'birthday',
          data: { ...b, birthDate: birthdayDateForYear(b.birthDate, y).toISOString() },
        });
      }
    }

    const getDate = (item: CalItem) =>
      item.kind === 'birthday' ? item.data.birthDate : item.data.date;

    return [...evItems, ...mItems, ...bItems].sort(
      (a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()
    );
  }, [events, matches, birthdays, currentMonth]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {};
    allItems.forEach(item => {
      const d   = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      const key = format(new Date(d), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [allItems]);

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  const dayItems = useMemo(() => {
    if (!selectedDay) return [];
    return allItems.filter(item => {
      const d = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      return isSameDay(new Date(d), selectedDay);
    });
  }, [allItems, selectedDay]);

  const listItems = useMemo(() => {
    const now = new Date();
    return allItems.filter(item => {
      const d = new Date(item.kind === 'birthday' ? item.data.birthDate : item.data.date);
      if (listFilter === 'upcoming') return d >= now;
      if (listFilter === 'past')    return d < now;
      return true;
    });
  }, [allItems, listFilter]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-2xl font-bold text-gray-900">Calendrier</Text>
          <Text className="text-sm text-gray-500 mt-0.5">
            Entraînements, matchs, événements et anniversaires
          </Text>
        </View>

        {/* Toggle vue */}
        <View className="mx-4 mt-2 mb-3 flex-row bg-white rounded-xl border border-gray-200 p-1 self-start">
          {([['calendar', '📅 Calendrier'], ['list', '📋 Liste']] as [ViewMode, string][]).map(([v, label]) => (
            <TouchableOpacity
              key={v}
              onPress={() => setViewMode(v)}
              className={`px-4 py-1.5 rounded-lg ${viewMode === v ? 'bg-blue-600' : ''}`}
            >
              <Text className={`text-sm font-medium ${viewMode === v ? 'text-white' : 'text-gray-600'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : viewMode === 'calendar' ? (
          <CalendarGrid
            days={calDays}
            currentMonth={currentMonth}
            selectedDay={selectedDay}
            itemsByDay={itemsByDay}
            dayItems={dayItems}
            colors={colors}
            isCoach={isCoach}
            onPrev={() => { setSelectedDay(null); setCurrentMonth(m => subMonths(m, 1)); }}
            onNext={() => { setSelectedDay(null); setCurrentMonth(m => addMonths(m, 1)); }}
            onSelectDay={day => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
          />
        ) : (
          <ListView
            items={listItems}
            filter={listFilter}
            colors={colors}
            onFilterChange={setListFilter}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── CalendarGrid ───────────────────────────────────────────────────────── */

function CalendarGrid({
  days, currentMonth, selectedDay, itemsByDay, dayItems,
  colors, onPrev, onNext, onSelectDay,
}: {
  days: Date[];
  currentMonth: Date;
  selectedDay: Date | null;
  itemsByDay: Record<string, CalItem[]>;
  dayItems: CalItem[];
  colors: Colors;
  isCoach: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (d: Date) => void;
}) {
  const today = new Date();

  return (
    <View className="px-4">
      {/* Navigation mois */}
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity
          onPress={onPrev}
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 items-center justify-center"
        >
          <Text className="text-gray-600 text-xl leading-none">‹</Text>
        </TouchableOpacity>

        <Text className="font-bold text-gray-900 text-lg capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </Text>

        <TouchableOpacity
          onPress={onNext}
          className="w-9 h-9 rounded-xl bg-white border border-gray-200 items-center justify-center"
        >
          <Text className="text-gray-600 text-xl leading-none">›</Text>
        </TouchableOpacity>
      </View>

      {/* Grille calendrier */}
      <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Entêtes jours de la semaine */}
        <View className="flex-row border-b border-gray-100">
          {DOW.map(d => (
            <View key={d} style={{ width: `${100 / 7}%` }} className="items-center py-2">
              <Text className="text-xs font-semibold text-gray-400">{d}</Text>
            </View>
          ))}
        </View>

        {/* Cellules des jours */}
        <View className="flex-row flex-wrap">
          {days.map((day, i) => {
            const key         = format(day, 'yyyy-MM-dd');
            const items       = itemsByDay[key] || [];
            const isToday     = isSameDay(day, today);
            const isSelected  = !!selectedDay && isSameDay(day, selectedDay);
            const inMonth     = isSameMonth(day, currentMonth);
            const hasBirthday = items.some(it => it.kind === 'birthday');
            const dotItems    = items.filter(it => it.kind !== 'birthday');

            return (
              <TouchableOpacity
                key={i}
                onPress={() => onSelectDay(day)}
                style={{ width: `${100 / 7}%`, minHeight: 56 }}
                className={[
                  'items-center pt-1.5 pb-1 border-b border-r border-gray-50',
                  isSelected ? 'bg-blue-50' : '',
                  !inMonth ? 'opacity-30' : '',
                ].join(' ')}
              >
                {/* Numéro du jour */}
                <View className={`w-7 h-7 rounded-full items-center justify-center mb-0.5 ${isToday ? 'bg-blue-600' : ''}`}>
                  <Text className={`text-sm ${isToday ? 'text-white font-bold' : isSelected ? 'text-blue-700 font-bold' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </Text>
                </View>

                {/* Emoji anniversaire */}
                {hasBirthday && (
                  <Text style={{ fontSize: 10, lineHeight: 12 }}>🎂</Text>
                )}

                {/* Points de couleur par événement */}
                {dotItems.length > 0 && (
                  <View className="flex-row flex-wrap justify-center" style={{ gap: 2 }}>
                    {dotItems.slice(0, 3).map((it, j) => (
                      <View
                        key={j}
                        style={{
                          width: 6, height: 6, borderRadius: 3,
                          backgroundColor: itemColor(it, colors),
                        }}
                      />
                    ))}
                    {dotItems.length > 3 && (
                      <Text style={{ fontSize: 9, color: '#9ca3af', lineHeight: 10 }}>
                        +{dotItems.length - 3}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Panneau du jour sélectionné */}
      {selectedDay && (
        <View className="mt-3">
          <Text className="font-semibold text-gray-700 capitalize mb-2">
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </Text>
          {dayItems.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-200 py-10 items-center">
              <Text className="text-gray-400 text-sm">Aucun événement ce jour.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {dayItems.map((item, i) => (
                <ItemPreview key={i} item={item} colors={colors} />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ─── ItemPreview — carte simple (enrichie Partie 2) ─────────────────────── */

function ItemPreview({ item, colors }: { item: CalItem; colors: Colors }) {
  if (item.kind === 'birthday') {
    return (
      <View className="flex-row items-center bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3" style={{ gap: 12 }}>
        <Text style={{ fontSize: 24 }}>🎂</Text>
        <View>
          <Text className="font-semibold text-gray-900">
            {item.data.firstName} {item.data.lastName}
          </Text>
          <Text className="text-xs text-rose-400">Anniversaire</Text>
        </View>
      </View>
    );
  }

  const color = itemColor(item, colors);
  const label = item.kind === 'match' ? `vs ${item.data.opponent}` : item.data.title;
  const time  = format(new Date(item.data.date), 'HH:mm');

  return (
    <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <View style={{ height: 4, backgroundColor: color }} />
      <View className="px-4 py-3 flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-gray-900" numberOfLines={1}>{label}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{time}</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── ListView ───────────────────────────────────────────────────────────── */

function ListView({
  items, filter, colors, onFilterChange,
}: {
  items: CalItem[];
  filter: ListFilter;
  colors: Colors;
  onFilterChange: (f: ListFilter) => void;
}) {
  const grouped = useMemo(() => {
    const map: { key: string; label: string; items: CalItem[] }[] = [];
    const seen: Record<string, number> = {};
    for (const item of items) {
      const raw = item.kind === 'birthday' ? item.data.birthDate : item.data.date;
      const d   = new Date(raw);
      const key = format(d, 'yyyy-MM-dd');
      if (seen[key] == null) {
        seen[key] = map.length;
        map.push({ key, label: format(d, 'EEEE d MMMM yyyy', { locale: fr }), items: [] });
      }
      map[seen[key]].items.push(item);
    }
    return map;
  }, [items]);

  return (
    <View className="px-4">
      {/* Filtres */}
      <View className="flex-row bg-white rounded-xl border border-gray-200 p-1 self-start mb-4">
        {([['upcoming', 'À venir'], ['past', 'Passés'], ['all', 'Tous']] as [ListFilter, string][]).map(([v, label]) => (
          <TouchableOpacity
            key={v}
            onPress={() => onFilterChange(v)}
            className={`px-4 py-1.5 rounded-lg ${filter === v ? 'bg-blue-600' : ''}`}
          >
            <Text className={`text-sm font-medium ${filter === v ? 'text-white' : 'text-gray-600'}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenu groupé par jour */}
      {grouped.length === 0 ? (
        <View className="bg-white rounded-2xl border border-gray-200 py-12 items-center">
          <Text className="text-3xl mb-2">📅</Text>
          <Text className="text-gray-400 text-sm">
            {filter === 'upcoming' ? 'Aucun événement à venir'
              : filter === 'past'  ? 'Aucun événement passé'
              : 'Aucun événement'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {grouped.map(({ key, label, items: gItems }) => (
            <View key={key} style={{ gap: 8 }}>
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">
                {label}
              </Text>
              {gItems.map((item, i) => (
                <ItemPreview key={i} item={item} colors={colors} />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
