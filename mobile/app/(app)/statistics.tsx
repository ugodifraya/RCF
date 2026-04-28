import { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { PlayerStat } from '../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface MyStats {
  attendance: { total: number; present: number; absent: number; rate: number };
  matchStats: { goals: number; assists: number; minutesPlayed: number; matchesPlayed: number };
  recentMatches: {
    id: string; goals: number; assists: number; minutesPlayed: number; rating: number | null;
    match: { date: string; opponent: string; homeAway: string; scoreHome: number | null; scoreAway: number | null };
  }[];
  injuries: { status: string; type: string }[];
}

interface TeamStats {
  totalPlayers: number;
  totalEvents: number;
  totalMatches: number;
  matchResults: { wins: number; losses: number; draws: number; total: number };
  attendanceStats: { status: string; _count: { status: number } }[];
}

type SortKey = 'goals' | 'assists' | 'attendanceRate' | 'matchesPlayed';

/* ─── Helpers UI ─────────────────────────────────────────────────────────── */

function StatCard({ value, label, color, bg }: { value: string | number; label: string; color: string; bg: string }) {
  return (
    <View className="flex-1 rounded-2xl border items-center py-4" style={{ backgroundColor: bg, borderColor: bg }}>
      <Text className="text-3xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-xs text-gray-500 mt-1 text-center">{label}</Text>
    </View>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View className="h-2 bg-gray-100 rounded-full overflow-hidden flex-1">
      <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl border border-gray-200 px-4 py-4" style={{ gap: 12 }}>
      <Text className="font-semibold text-gray-900">{title}</Text>
      {children}
    </View>
  );
}

/* ─── Écran principal ────────────────────────────────────────────────────── */

export default function StatisticsScreen() {
  const { isCoach } = useAuth();
  const [myStats,     setMyStats]     = useState<MyStats | null>(null);
  const [teamStats,   setTeamStats]   = useState<TeamStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [sortBy,      setSortBy]      = useState<SortKey>('goals');

  useEffect(() => {
    if (isCoach) {
      Promise.all([api.get('/stats/team'), api.get('/stats/players')])
        .then(([t, p]) => { setTeamStats(t.data); setPlayerStats(p.data); })
        .finally(() => setLoading(false));
    } else {
      api.get('/stats/my-stats')
        .then(r => setMyStats(r.data))
        .finally(() => setLoading(false));
    }
  }, [isCoach]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-gray-900">
          {isCoach ? 'Statistiques équipe' : 'Mes statistiques'}
        </Text>
        {isCoach
          ? <CoachView teamStats={teamStats} playerStats={playerStats} sortBy={sortBy} onSort={setSortBy} />
          : <PlayerView stats={myStats} />
        }
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Vue Coach ──────────────────────────────────────────────────────────── */

function CoachView({ teamStats, playerStats, sortBy, onSort }: {
  teamStats: TeamStats | null;
  playerStats: PlayerStat[];
  sortBy: SortKey;
  onSort: (s: SortKey) => void;
}) {
  const sorted = useMemo(
    () => [...playerStats].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number)),
    [playerStats, sortBy]
  );

  const attTotal = teamStats?.attendanceStats.reduce((s, a) => s + a._count.status, 0) || 0;
  const attPresent = teamStats?.attendanceStats.find(a => a.status === 'PRESENT')?._count.status || 0;
  const attAbsent  = teamStats?.attendanceStats.find(a => a.status === 'ABSENT')?._count.status  || 0;

  const matchTotal = teamStats?.matchResults.total || 0;

  return (
    <>
      {/* Cartes chiffres clés */}
      {teamStats && (
        <View className="flex-row" style={{ gap: 10 }}>
          <StatCard value={teamStats.totalPlayers}        label="Joueuses"  color="#2563eb" bg="#eff6ff" />
          <StatCard value={teamStats.matchResults.wins}   label="Victoires" color="#16a34a" bg="#f0fdf4" />
          <StatCard value={teamStats.matchResults.losses} label="Défaites"  color="#dc2626" bg="#fef2f2" />
          <StatCard value={teamStats.matchResults.draws}  label="Nuls"      color="#6b7280" bg="#f9fafb" />
        </View>
      )}

      {/* Résultats matchs */}
      {matchTotal > 0 && teamStats && (
        <Section title="Résultats des matchs">
          {[
            { label: 'Victoires', value: teamStats.matchResults.wins,   color: '#22c55e' },
            { label: 'Nuls',      value: teamStats.matchResults.draws,  color: '#94a3b8' },
            { label: 'Défaites',  value: teamStats.matchResults.losses, color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <View key={label} className="flex-row items-center" style={{ gap: 10 }}>
              <Text className="text-sm text-gray-600 w-16">{label}</Text>
              <ProgressBar pct={(value / matchTotal) * 100} color={color} />
              <Text className="text-sm font-semibold text-gray-700 w-6 text-right">{value}</Text>
            </View>
          ))}
        </Section>
      )}

      {/* Présences globales */}
      {attTotal > 0 && (
        <Section title="Présences globales">
          {[
            { label: 'Présences',  value: attPresent, color: '#22c55e' },
            { label: 'Absences',   value: attAbsent,  color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <View key={label} className="flex-row items-center" style={{ gap: 10 }}>
              <Text className="text-sm text-gray-600 w-16">{label}</Text>
              <ProgressBar pct={(value / attTotal) * 100} color={color} />
              <Text className="text-sm font-semibold text-gray-700 w-8 text-right">{value}</Text>
            </View>
          ))}
          <Text className="text-xs text-gray-400">Total : {attTotal} réponse(s)</Text>
        </Section>
      )}

      {/* Stats individuelles */}
      <Section title="Statistiques individuelles">
        {/* Tri */}
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {([
            ['goals', '⚽ Buts'], ['assists', '🎯 Passes D.'],
            ['attendanceRate', '📅 Présence'], ['matchesPlayed', '🏟 Matchs'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => onSort(key)}
              className={`px-3 py-1.5 rounded-full border ${sortBy === key ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
            >
              <Text className={`text-xs font-medium ${sortBy === key ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {sorted.length === 0 ? (
          <Text className="text-gray-400 text-sm text-center py-4">Aucune donnée disponible.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {sorted.map((p, i) => (
              <PlayerStatRow key={p.id} player={p} rank={i + 1} sortBy={sortBy} />
            ))}
          </View>
        )}
      </Section>
    </>
  );
}

function PlayerStatRow({ player: p, rank, sortBy }: { player: PlayerStat; rank: number; sortBy: SortKey }) {
  const highlight = sortBy === 'goals' ? p.goals
    : sortBy === 'assists' ? p.assists
    : sortBy === 'attendanceRate' ? `${p.attendanceRate}%`
    : p.matchesPlayed;

  return (
    <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2.5" style={{ gap: 10 }}>
      <Text className="text-xs text-gray-400 w-5 text-center">{rank}</Text>
      <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
        <Text className="text-blue-700 text-xs font-bold">{p.firstName[0]}{p.lastName[0]}</Text>
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>{p.firstName} {p.lastName}</Text>
        {p.position && <Text className="text-xs text-gray-400" numberOfLines={1}>{p.position}</Text>}
      </View>
      <Text className="text-base font-bold text-blue-600 w-10 text-right">{highlight}</Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text className="text-xs text-gray-500">⚽{p.goals}</Text>
        <Text className="text-xs text-gray-500">🎯{p.assists}</Text>
        {p.avgRating != null && (
          <Text className={`text-xs font-semibold ${p.avgRating >= 7 ? 'text-green-600' : p.avgRating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
            ★{p.avgRating}
          </Text>
        )}
        {p.activeInjuries > 0 && <Text className="text-xs text-red-500">🤕</Text>}
      </View>
    </View>
  );
}

/* ─── Vue Joueuse ────────────────────────────────────────────────────────── */

function PlayerView({ stats }: { stats: MyStats | null }) {
  if (!stats) return null;
  const { attendance, matchStats, recentMatches, injuries } = stats;
  const attTotal = attendance.total || 1;

  return (
    <>
      {/* Cartes */}
      <View className="flex-row" style={{ gap: 10 }}>
        <StatCard value={`${attendance.rate}%`}       label="Présence"  color="#16a34a" bg="#f0fdf4" />
        <StatCard value={matchStats.goals}             label="Buts"      color="#2563eb" bg="#eff6ff" />
        <StatCard value={matchStats.assists}           label="Passes D." color="#7c3aed" bg="#f5f3ff" />
        <StatCard value={matchStats.matchesPlayed}     label="Matchs"    color="#d97706" bg="#fffbeb" />
      </View>

      {/* Présence */}
      <Section title="Présence aux événements">
        {[
          { label: 'Présences', value: attendance.present, pct: (attendance.present / attTotal) * 100, color: '#22c55e' },
          { label: 'Absences',  value: attendance.absent,  pct: (attendance.absent  / attTotal) * 100, color: '#ef4444' },
        ].map(({ label, value, pct, color }) => (
          <View key={label} style={{ gap: 4 }}>
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-600">{label}</Text>
              <Text className="text-sm font-medium" style={{ color }}>{value}</Text>
            </View>
            <ProgressBar pct={pct} color={color} />
          </View>
        ))}
        <Text className="text-xs text-gray-400">Total : {attendance.total} événement(s)</Text>
      </Section>

      {/* Blessures */}
      <Section title="Blessures">
        {injuries.length === 0 ? (
          <View className="items-center py-3" style={{ gap: 6 }}>
            <Text className="text-3xl">💪</Text>
            <Text className="text-gray-400 text-sm">Aucune blessure enregistrée</Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {injuries.map((inj, i) => (
              <View key={i} className={`flex-row items-center justify-between px-3 py-2 rounded-xl ${inj.status === 'ACTIVE' ? 'bg-red-50' : 'bg-green-50'}`}>
                <Text className="text-sm text-gray-700">{inj.type}</Text>
                <View className={`px-2 py-0.5 rounded-full ${inj.status === 'ACTIVE' ? 'bg-red-100' : 'bg-green-100'}`}>
                  <Text className={`text-xs font-semibold ${inj.status === 'ACTIVE' ? 'text-red-700' : 'text-green-700'}`}>
                    {inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* Derniers matchs */}
      {recentMatches.length > 0 && (
        <Section title="Mes 5 derniers matchs">
          <View style={{ gap: 8 }}>
            {recentMatches.map((m, i) => (
              <View key={i} className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2.5" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>vs {m.match.opponent}</Text>
                  <Text className="text-xs text-gray-400">{format(new Date(m.match.date), 'd MMM yyyy', { locale: fr })}</Text>
                </View>
                <Text className="text-xs text-gray-500">{m.minutesPlayed}'</Text>
                <Text className="text-xs text-gray-700">⚽{m.goals}</Text>
                <Text className="text-xs text-gray-700">🎯{m.assists}</Text>
                {m.rating != null ? (
                  <Text className={`text-sm font-bold ${m.rating >= 7 ? 'text-green-600' : m.rating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    ★{m.rating}
                  </Text>
                ) : (
                  <Text className="text-xs text-gray-400">—</Text>
                )}
              </View>
            ))}
          </View>
        </Section>
      )}
    </>
  );
}
