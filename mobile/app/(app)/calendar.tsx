import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  format, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';

const DOW = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

export default function CalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay]   = useState<Date | null>(null);
  const today = new Date();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end   = endOfWeek(endOfMonth(currentMonth),   { weekStartsOn: 1 });
    const result: Date[] = [];
    let d = start;
    while (d <= end) { result.push(d); d = addDays(d, 1); }
    return result;
  }, [currentMonth]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        {/* Titre */}
        <Text className="text-2xl font-bold text-gray-900 mb-4">Calendrier</Text>

        {/* Navigation mois */}
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={() => { setSelectedDay(null); setCurrentMonth(m => subMonths(m, 1)); }}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 items-center justify-center"
          >
            <Text className="text-gray-600 text-xl">‹</Text>
          </TouchableOpacity>

          <Text className="text-lg font-bold text-gray-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </Text>

          <TouchableOpacity
            onPress={() => { setSelectedDay(null); setCurrentMonth(m => addMonths(m, 1)); }}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 items-center justify-center"
          >
            <Text className="text-gray-600 text-xl">›</Text>
          </TouchableOpacity>
        </View>

        {/* Grille */}
        <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Entêtes */}
          <View className="flex-row border-b border-gray-100">
            {DOW.map(d => (
              <View key={d} style={{ width: `${100 / 7}%` }} className="items-center py-2">
                <Text className="text-xs font-semibold text-gray-400">{d}</Text>
              </View>
            ))}
          </View>

          {/* Jours */}
          <View className="flex-row flex-wrap">
            {days.map((day, i) => {
              const isToday    = isSameDay(day, today);
              const isSelected = !!selectedDay && isSameDay(day, selectedDay);
              const inMonth    = isSameMonth(day, currentMonth);

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedDay(prev => prev && isSameDay(prev, day) ? null : day)}
                  style={{ width: `${100 / 7}%`, minHeight: 48 }}
                  className={`items-center justify-center border-b border-r border-gray-50
                    ${isSelected ? 'bg-blue-50' : ''}
                    ${!inMonth   ? 'opacity-30' : ''}
                  `}
                >
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${isToday ? 'bg-blue-600' : ''}`}>
                    <Text className={`text-sm
                      ${isToday    ? 'text-white font-bold'   : ''}
                      ${isSelected && !isToday ? 'text-blue-700 font-bold' : ''}
                      ${!isToday && !isSelected ? 'text-gray-700' : ''}
                    `}>
                      {format(day, 'd')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Jour sélectionné */}
        {selectedDay && (
          <View className="mt-4 bg-white rounded-2xl border border-gray-200 py-8 items-center">
            <Text className="font-semibold text-gray-700 capitalize">
              {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
            </Text>
            <Text className="text-gray-400 text-sm mt-1">Aucun événement</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
