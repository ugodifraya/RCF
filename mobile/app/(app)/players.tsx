import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../src/services/api';
import { User, Injury } from '../../src/types';

const POSITIONS = [
  'Gardienne', 'Défenseure centrale', 'Latérale droite', 'Latérale gauche',
  'Milieu défensif', 'Milieu central', 'Milieu offensif',
  'Ailière droite', 'Ailière gauche', 'Attaquante', 'Avant-centre',
];

function getAge(birthDate?: string | null) {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function PlayersScreen() {
  const [players,   setPlayers]   = useState<User[]>([]);
  const [injuries,  setInjuries]  = useState<Injury[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [posFilter, setPosFilter] = useState('');

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/injuries')])
      .then(([u, inj]) => {
        setPlayers(u.data.filter((p: User) => p.role === 'PLAYER'));
        setInjuries(inj.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeInjuries = useMemo(
    () => injuries.filter(i => i.status === 'ACTIVE'),
    [injuries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return players.filter(p => {
      const matchName = !q ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q);
      const matchPos = !posFilter || p.position === posFilter;
      return matchName && matchPos;
    });
  }, [players, search, posFilter]);

  const presentPositions = useMemo(
    () => POSITIONS.filter(pos => players.some(p => p.position === pos)),
    [players]
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">

      {/* Header */}
      <View className="px-4 pt-4 pb-3">
        <Text className="text-2xl font-bold text-gray-900">Joueuses</Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Effectif · {players.length} joueuse{players.length !== 1 ? 's' : ''}
        </Text>

        {/* Recherche */}
        <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 mt-3" style={{ gap: 8 }}>
          <Text className="text-gray-400">🔍</Text>
          <TextInput
            className="flex-1 py-2.5 text-gray-900 text-sm"
            placeholder="Rechercher une joueuse…"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filtres postes */}
      {presentPositions.length > 0 && (
        <View className="mb-2">
          <FlatList
            horizontal
            data={['', ...presentPositions]}
            keyExtractor={item => item || '_all'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setPosFilter(item)}
                className={`px-3 py-1.5 rounded-full border ${
                  posFilter === item ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'
                }`}
              >
                <Text className={`text-xs font-medium ${posFilter === item ? 'text-white' : 'text-gray-600'}`}>
                  {item || 'Tous les postes'}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Liste */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-4xl mb-3">👥</Text>
              <Text className="text-gray-400 text-sm text-center">
                {search || posFilter
                  ? 'Aucun résultat pour ce filtre.'
                  : "Aucune joueuse dans l'effectif."}
              </Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const playerInjuries = activeInjuries.filter(i => i.userId === p.id);
            const age     = getAge(p.birthDate);
            const initials = `${p.firstName[0]}${p.lastName[0]}`.toUpperCase();
            const injured  = playerInjuries.length > 0;

            return (
              <View className={`bg-white rounded-2xl border px-4 py-3 ${injured ? 'border-red-200' : 'border-gray-200'}`}>
                <View className="flex-row items-center" style={{ gap: 12 }}>

                  {/* Avatar initiales */}
                  <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                    <Text className="text-blue-700 font-bold text-base">{initials}</Text>
                  </View>

                  {/* Infos */}
                  <View className="flex-1 min-w-0">
                    <Text className="font-semibold text-gray-900">{p.firstName} {p.lastName}</Text>
                    <View className="flex-row items-center mt-0.5" style={{ gap: 8 }}>
                      {p.position && <Text className="text-xs text-gray-500" numberOfLines={1}>{p.position}</Text>}
                      {age != null && <Text className="text-xs text-gray-400">{age} ans</Text>}
                    </View>
                    {p.email && <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>{p.email}</Text>}
                  </View>

                  {/* Badge */}
                  <View className={`px-2.5 py-1 rounded-full ${injured ? 'bg-red-100' : 'bg-green-100'}`}>
                    <Text className={`text-xs font-semibold ${injured ? 'text-red-700' : 'text-green-700'}`}>
                      {injured ? 'Blessée' : 'Fit'}
                    </Text>
                  </View>
                </View>

                {/* Détail blessures */}
                {injured && (
                  <View className="mt-3 pt-3 border-t border-gray-100" style={{ gap: 2 }}>
                    {playerInjuries.map(inj => (
                      <Text key={inj.id} className="text-xs text-red-600">
                        ⚠️ {inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
