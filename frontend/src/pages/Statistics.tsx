import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { PlayerStat } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

export default function Statistics() {
  const { isCoach } = useAuth();
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'goals' | 'assists' | 'attendanceRate' | 'matchesPlayed'>('goals');

  useEffect(() => {
    if (isCoach) {
      Promise.all([
        api.get('/stats/team'),
        api.get('/stats/players'),
      ]).then(([t, p]) => {
        setTeamStats(t.data);
        setPlayerStats(p.data);
      }).finally(() => setLoading(false));
    } else {
      api.get('/stats/my-stats').then(r => setMyStats(r.data)).finally(() => setLoading(false));
    }
  }, [isCoach]);

  if (loading) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  if (!isCoach) return <PlayerStatView stats={myStats} />;

  const sorted = [...playerStats].sort((a, b) => (b[sortBy] as number) - (a[sortBy] as number));

  const pieData = teamStats ? [
    { name: 'Victoires', value: teamStats.matchResults.wins, color: '#22c55e' },
    { name: 'Nuls', value: teamStats.matchResults.draws, color: '#94a3b8' },
    { name: 'Défaites', value: teamStats.matchResults.losses, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const attendanceData = teamStats?.attendanceStats.map(s => ({
    name: s.status === 'PRESENT' ? 'Présences' : s.status === 'ABSENT' ? 'Absences' : s.status === 'MAYBE' ? 'Peut-être' : 'En attente',
    value: s._count.status,
    color: s.status === 'PRESENT' ? '#22c55e' : s.status === 'ABSENT' ? '#ef4444' : s.status === 'MAYBE' ? '#eab308' : '#94a3b8',
  })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Statistiques équipe</h1>

      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center"><p className="text-3xl font-bold text-primary-600">{teamStats.totalPlayers}</p><p className="text-sm text-gray-500 mt-1">Joueuses</p></div>
          <div className="card p-4 text-center"><p className="text-3xl font-bold text-green-600">{teamStats.matchResults.wins}</p><p className="text-sm text-gray-500 mt-1">Victoires</p></div>
          <div className="card p-4 text-center"><p className="text-3xl font-bold text-red-600">{teamStats.matchResults.losses}</p><p className="text-sm text-gray-500 mt-1">Défaites</p></div>
          <div className="card p-4 text-center"><p className="text-3xl font-bold text-gray-600">{teamStats.matchResults.draws}</p><p className="text-sm text-gray-500 mt-1">Nuls</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pieData.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Résultats des matchs</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {attendanceData.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Présences globales</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attendanceData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {attendanceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-gray-900">Statistiques individuelles</h2>
          <div className="flex gap-2 flex-wrap">
            {(['goals', 'assists', 'attendanceRate', 'matchesPlayed'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${sortBy === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'goals' ? 'Buts' : s === 'assists' ? 'Passes D.' : s === 'attendanceRate' ? 'Présence' : 'Matchs'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Joueuse</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Présence</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Matchs</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">⚽</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">🎯</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Min.</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">🟨</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Note moy.</th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">Blessures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-semibold">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-gray-400">{p.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-3">
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${p.attendanceRate}%` }} />
                      </div>
                      <span className="text-xs text-gray-600">{p.attendanceRate}%</span>
                    </div>
                  </td>
                  <td className="text-center px-3 text-gray-700">{p.matchesPlayed}</td>
                  <td className="text-center px-3 font-semibold text-gray-900">{p.goals}</td>
                  <td className="text-center px-3 text-gray-700">{p.assists}</td>
                  <td className="text-center px-3 text-gray-500 text-xs">{p.minutesPlayed}'</td>
                  <td className="text-center px-3 text-gray-700">{p.yellowCards > 0 ? p.yellowCards : '—'}</td>
                  <td className="text-center px-3">
                    {p.avgRating ? (
                      <span className={`font-semibold text-sm ${p.avgRating >= 7 ? 'text-green-600' : p.avgRating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {p.avgRating}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="text-center px-3">
                    {p.activeInjuries > 0 ? <span className="badge-red">{p.activeInjuries} active(s)</span> : <span className="text-green-500 text-xs">✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlayerStatView({ stats }: { stats: MyStats | null }) {
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mes statistiques</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center bg-green-50 border-green-200">
          <p className="text-3xl font-bold text-green-600">{stats.attendance.rate}%</p>
          <p className="text-sm text-gray-500 mt-1">Présence</p>
        </div>
        <div className="card p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-3xl font-bold text-blue-600">{stats.matchStats.goals}</p>
          <p className="text-sm text-gray-500 mt-1">Buts</p>
        </div>
        <div className="card p-4 text-center bg-purple-50 border-purple-200">
          <p className="text-3xl font-bold text-purple-600">{stats.matchStats.assists}</p>
          <p className="text-sm text-gray-500 mt-1">Passes décisives</p>
        </div>
        <div className="card p-4 text-center bg-orange-50 border-orange-200">
          <p className="text-3xl font-bold text-orange-600">{stats.matchStats.matchesPlayed}</p>
          <p className="text-sm text-gray-500 mt-1">Matchs joués</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Présence aux événements</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Présences</span>
                  <span className="font-medium text-green-600">{stats.attendance.present}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.attendance.total > 0 ? (stats.attendance.present / stats.attendance.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Absences</span>
                  <span className="font-medium text-red-600">{stats.attendance.absent}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${stats.attendance.total > 0 ? (stats.attendance.absent / stats.attendance.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Total : {stats.attendance.total} événement(s)</p>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Blessures</h2>
          {stats.injuries.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-2">💪</p>
              <p className="text-gray-500 text-sm">Aucune blessure enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.injuries.map((inj, i) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${inj.status === 'ACTIVE' ? 'bg-red-50' : 'bg-green-50'}`}>
                  <span className="text-sm text-gray-700">{inj.type}</span>
                  <span className={inj.status === 'ACTIVE' ? 'badge-red' : 'badge-green'}>{inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats.recentMatches.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Mes 5 derniers matchs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Match</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Min.</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">⚽</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">🎯</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentMatches.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4">
                      <p className="font-medium text-gray-900">{m.match.opponent}</p>
                      <p className="text-xs text-gray-400">{new Date(m.match.date).toLocaleDateString('fr-FR')}</p>
                    </td>
                    <td className="text-center px-3 text-gray-700">{m.minutesPlayed}'</td>
                    <td className="text-center px-3 font-semibold">{m.goals}</td>
                    <td className="text-center px-3">{m.assists}</td>
                    <td className="text-center px-3">
                      {m.rating ? (
                        <span className={`font-semibold ${m.rating >= 7 ? 'text-green-600' : m.rating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {m.rating}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
