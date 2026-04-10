import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Match, User, PlayerMatchStat } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface StatForm {
  userId: string;
  minutesPlayed: string;
  goals: string;
  assists: string;
  yellowCards: string;
  redCards: string;
  rating: string;
  starter: boolean;
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { isCoach } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<User[]>([]);
  const [statForms, setStatForms] = useState<StatForm[]>([]);
  const [showStatsForm, setShowStatsForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get(`/matches/${id}`).then(r => {
      setMatch(r.data);
    });
  };

  useEffect(() => {
    load();
    if (isCoach) {
      api.get('/users/players').then(r => setPlayers(r.data));
    }
  }, [id, isCoach]);

  const openStatsForm = () => {
    if (!match) return;
    const forms: StatForm[] = players.map(p => {
      const existing = match.playerStats?.find(s => s.userId === p.id);
      return {
        userId: p.id,
        minutesPlayed: existing?.minutesPlayed?.toString() || '0',
        goals: existing?.goals?.toString() || '0',
        assists: existing?.assists?.toString() || '0',
        yellowCards: existing?.yellowCards?.toString() || '0',
        redCards: existing?.redCards?.toString() || '0',
        rating: existing?.rating?.toString() || '',
        starter: existing?.starter || false,
      };
    });
    setStatForms(forms);
    setShowStatsForm(true);
  };

  const handleSaveStats = async () => {
    setSaving(true);
    try {
      await api.post(`/matches/${id}/stats`, { playerStats: statForms.filter(s => parseInt(s.minutesPlayed) > 0 || s.starter) });
      setShowStatsForm(false);
      load();
    } catch { } finally { setSaving(false); }
  };

  const updateStat = (userId: string, field: string, value: string | boolean) => {
    setStatForms(prev => prev.map(s => s.userId === userId ? { ...s, [field]: value } : s));
  };

  if (!match) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  const ours = match.homeAway === 'HOME' ? match.scoreHome : match.scoreAway;
  const theirs = match.homeAway === 'HOME' ? match.scoreAway : match.scoreHome;
  const result = ours !== null && ours !== undefined && theirs !== null && theirs !== undefined
    ? ours > theirs ? 'Victoire' : ours < theirs ? 'Défaite' : 'Nul'
    : null;
  const resultColor = result === 'Victoire' ? 'text-green-600' : result === 'Défaite' ? 'text-red-600' : 'text-gray-600';

  const starters = match.playerStats?.filter(s => s.starter) || [];
  const subs = match.playerStats?.filter(s => !s.starter && s.minutesPlayed > 0) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/matches')} className="text-gray-400 hover:text-gray-600">← Retour</button>
      </div>

      <div className="card">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">
            {format(new Date(match.date), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
            {match.location && ` · ${match.location}`}
          </p>
          {match.competition && <p className="text-xs text-gray-400 mb-4">{match.competition}</p>}
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="font-bold text-gray-900 text-lg">RCF</p>
              <p className="text-xs text-gray-400">{match.homeAway === 'HOME' ? 'Domicile' : 'Extérieur'}</p>
            </div>
            <div className="text-center">
              {ours !== null && ours !== undefined ? (
                <div>
                  <p className="text-4xl font-bold text-gray-900">{ours} – {theirs}</p>
                  {result && <p className={`text-sm font-semibold mt-1 ${resultColor}`}>{result}</p>}
                </div>
              ) : (
                <p className="text-2xl font-light text-gray-400">vs</p>
              )}
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-lg">{match.opponent}</p>
              <p className="text-xs text-gray-400">{match.homeAway === 'AWAY' ? 'Domicile' : 'Extérieur'}</p>
            </div>
          </div>
          {match.notes && <p className="text-sm text-gray-500 mt-4 italic">"{match.notes}"</p>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Statistiques joueuses</h2>
        {isCoach && (
          <button onClick={openStatsForm} className="btn-primary">
            {match.playerStats?.length ? 'Modifier les stats' : 'Saisir les stats'}
          </button>
        )}
      </div>

      {match.playerStats && match.playerStats.length > 0 ? (
        <div className="space-y-4">
          {starters.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Titulaires</h3>
              <div className="card overflow-x-auto">
                <PlayerStatsTable stats={starters} />
              </div>
            </div>
          )}
          {subs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Remplaçantes</h3>
              <div className="card overflow-x-auto">
                <PlayerStatsTable stats={subs} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-400">Aucune statistique saisie pour ce match</p>
        </div>
      )}

      {showStatsForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">Saisir les statistiques</h2>
              <button onClick={() => setShowStatsForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 font-medium text-gray-700 min-w-[140px]">Joueuse</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">Tit.</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">Min.</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">⚽</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">🎯</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">🟨</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">🟥</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-700">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {statForms.map(sf => {
                      const player = players.find(p => p.id === sf.userId);
                      return (
                        <tr key={sf.userId}>
                          <td className="py-2 pr-4">
                            <p className="font-medium text-gray-900">{player?.firstName} {player?.lastName}</p>
                            <p className="text-xs text-gray-400">{player?.position}</p>
                          </td>
                          <td className="text-center px-2">
                            <input type="checkbox" checked={sf.starter} onChange={e => updateStat(sf.userId, 'starter', e.target.checked)} className="accent-primary-600" />
                          </td>
                          <td className="px-2">
                            <input type="number" min="0" max="120" value={sf.minutesPlayed} onChange={e => updateStat(sf.userId, 'minutesPlayed', e.target.value)} className="input text-center w-16 py-1" />
                          </td>
                          <td className="px-2">
                            <input type="number" min="0" value={sf.goals} onChange={e => updateStat(sf.userId, 'goals', e.target.value)} className="input text-center w-14 py-1" />
                          </td>
                          <td className="px-2">
                            <input type="number" min="0" value={sf.assists} onChange={e => updateStat(sf.userId, 'assists', e.target.value)} className="input text-center w-14 py-1" />
                          </td>
                          <td className="px-2">
                            <input type="number" min="0" max="2" value={sf.yellowCards} onChange={e => updateStat(sf.userId, 'yellowCards', e.target.value)} className="input text-center w-14 py-1" />
                          </td>
                          <td className="px-2">
                            <input type="number" min="0" max="1" value={sf.redCards} onChange={e => updateStat(sf.userId, 'redCards', e.target.value)} className="input text-center w-14 py-1" />
                          </td>
                          <td className="px-2">
                            <input type="number" min="0" max="10" step="0.5" value={sf.rating} onChange={e => updateStat(sf.userId, 'rating', e.target.value)} className="input text-center w-16 py-1" placeholder="/" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 pt-4 sticky bottom-0 bg-white pt-4 border-t border-gray-100 mt-4">
                <button onClick={handleSaveStats} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enregistrement...' : 'Enregistrer les statistiques'}
                </button>
                <button onClick={() => setShowStatsForm(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerStatsTable({ stats }: { stats: PlayerMatchStat[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-2 pr-4 font-medium text-gray-600">Joueuse</th>
          <th className="text-center py-2 px-3 font-medium text-gray-600">Min.</th>
          <th className="text-center py-2 px-3 font-medium text-gray-600">⚽</th>
          <th className="text-center py-2 px-3 font-medium text-gray-600">🎯</th>
          <th className="text-center py-2 px-3 font-medium text-gray-600">🟨</th>
          <th className="text-center py-2 px-3 font-medium text-gray-600">🟥</th>
          <th className="text-center py-2 px-3 font-medium text-gray-600">Note</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {stats.map(s => (
          <tr key={s.id}>
            <td className="py-2 pr-4">
              <p className="font-medium text-gray-900">{s.user?.firstName} {s.user?.lastName}</p>
              <p className="text-xs text-gray-400">{s.user?.position}</p>
            </td>
            <td className="text-center px-3 text-gray-700">{s.minutesPlayed}'</td>
            <td className="text-center px-3 font-semibold text-gray-900">{s.goals || '—'}</td>
            <td className="text-center px-3 text-gray-700">{s.assists || '—'}</td>
            <td className="text-center px-3 text-gray-700">{s.yellowCards > 0 ? s.yellowCards : '—'}</td>
            <td className="text-center px-3 text-gray-700">{s.redCards > 0 ? s.redCards : '—'}</td>
            <td className="text-center px-3">
              {s.rating ? (
                <span className={`font-semibold ${s.rating >= 7 ? 'text-green-600' : s.rating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {s.rating.toFixed(1)}
                </span>
              ) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
