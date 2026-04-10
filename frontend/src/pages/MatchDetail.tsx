import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Match, User, PlayerMatchStat } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Tab = 'infos' | 'joueuses' | 'stats';

interface MatchPlayerVote {
  id: string; matchId: string; voterId: string; votedForId: string;
  voter: { id: string; firstName: string; lastName: string };
  votedFor: { id: string; firstName: string; lastName: string };
}
interface MatchRating { id: string; matchId: string; userId: string; rating: number; }

interface MatchFull extends Match {
  playerVotes: MatchPlayerVote[];
  ratings: MatchRating[];
}

interface StatForm {
  userId: string; minutesPlayed: string; goals: string; assists: string;
  yellowCards: string; redCards: string; rating: string; starter: boolean;
}

const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1', '3-4-3'];

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isCoach } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<MatchFull | null>(null);
  const [players, setPlayers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('infos');
  const [statForms, setStatForms] = useState<StatForm[]>([]);
  const [showStatsForm, setShowStatsForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myVote, setMyVote] = useState<string>('');
  const [myRating, setMyRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const load = () => {
    api.get(`/matches/${id}`).then(r => {
      const m: MatchFull = r.data;
      setMatch(m);
      const myV = m.playerVotes?.find(v => v.voterId === user?.id);
      if (myV) setMyVote(myV.votedForId);
      const myR = m.ratings?.find(r => r.userId === user?.id);
      if (myR) setMyRating(myR.rating);
    });
  };

  useEffect(() => {
    load();
    api.get('/users/players').then(r => setPlayers(r.data));
  }, [id, user?.id]);

  const isPast = match ? new Date(match.date) < new Date() : false;

  const ours = match ? (match.homeAway === 'HOME' ? match.scoreHome : match.scoreAway) : null;
  const theirs = match ? (match.homeAway === 'HOME' ? match.scoreAway : match.scoreHome) : null;
  const result = ours !== null && ours !== undefined && theirs !== null && theirs !== undefined
    ? ours > theirs ? 'Victoire' : ours < theirs ? 'Défaite' : 'Nul' : null;

  // Calculs votes
  const voteCounts: Record<string, number> = {};
  match?.playerVotes?.forEach(v => { voteCounts[v.votedForId] = (voteCounts[v.votedForId] || 0) + 1; });
  const topVoteId = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topVoteCount = voteCounts[topVoteId] || 0;
  const totalVotes = match?.playerVotes?.length || 0;

  // Calcul note match
  const avgRating = match?.ratings?.length
    ? match.ratings.reduce((s, r) => s + r.rating, 0) / match.ratings.length : null;

  const handleVote = async (votedForId: string) => {
    setMyVote(votedForId);
    await api.post(`/matches/${id}/vote`, { votedForId });
    load();
  };

  const handleRate = async (rating: number) => {
    setMyRating(rating);
    await api.post(`/matches/${id}/rate`, { rating });
    load();
  };

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
      await api.post(`/matches/${id}/stats`, { playerStats: statForms });
      setShowStatsForm(false);
      load();
    } catch { } finally { setSaving(false); }
  };

  const updateStat = (userId: string, field: string, value: string | boolean) => {
    setStatForms(prev => prev.map(s => s.userId === userId ? { ...s, [field]: value } : s));
  };

  if (!match) return (
    <div className="text-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
    </div>
  );

  const starters = match.playerStats?.filter(s => s.starter) || [];
  const subs = match.playerStats?.filter(s => !s.starter && s.minutesPlayed > 0) || [];
  const topVotePlayer = players.find(p => p.id === topVoteId);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/matches')} className="text-gray-400 hover:text-gray-600 text-sm">← Retour</button>
      </div>

      {/* Score card */}
      <div className="bg-primary-900 rounded-2xl p-6 text-white">
        <p className="text-center text-primary-200 text-sm mb-4">
          {format(new Date(match.date), 'EEEE d MMMM yyyy', { locale: fr })}
          {match.location && ` · ${match.location}`}
        </p>
        {match.competition && <p className="text-center text-primary-300 text-xs mb-3">{match.competition}</p>}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center flex-1">
            <p className="font-bold text-lg leading-tight">{match.homeAway === 'HOME' ? 'RCF' : match.opponent}</p>
            <p className="text-primary-300 text-xs">{match.homeAway === 'HOME' ? 'Domicile' : 'Extérieur'}</p>
          </div>
          <div className="text-center shrink-0">
            {ours !== null && ours !== undefined ? (
              <div>
                <p className="text-5xl font-black">{match.homeAway === 'HOME' ? match.scoreHome : match.scoreAway} – {match.homeAway === 'HOME' ? match.scoreAway : match.scoreHome}</p>
                {result && (
                  <span className={`text-sm font-semibold mt-1 px-3 py-0.5 rounded-full inline-block ${
                    result === 'Victoire' ? 'bg-green-500' : result === 'Défaite' ? 'bg-red-500' : 'bg-gray-500'
                  }`}>{result}</span>
                )}
              </div>
            ) : (
              <p className="text-3xl font-light text-primary-300">vs</p>
            )}
          </div>
          <div className="text-center flex-1">
            <p className="font-bold text-lg leading-tight">{match.homeAway === 'HOME' ? match.opponent : 'RCF'}</p>
            <p className="text-primary-300 text-xs">{match.homeAway === 'HOME' ? 'Extérieur' : 'Domicile'}</p>
          </div>
        </div>
        {match.formation && (
          <p className="text-center text-primary-300 text-xs mt-3">Formation : {match.formation}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1">
        {([
          { key: 'infos', label: 'Infos' },
          { key: 'joueuses', label: 'Joueuses' },
          { key: 'stats', label: 'Stats' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* INFOS TAB */}
      {activeTab === 'infos' && (
        <div className="space-y-4">
          {/* Joueuse du match */}
          {isPast && (
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-4">🏆 Joueuse du match</h2>
              {topVotePlayer ? (
                <div className="text-center mb-4">
                  <div className="relative inline-block">
                    <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xl mx-auto">
                      {topVotePlayer.firstName[0]}{topVotePlayer.lastName[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs">⭐</div>
                  </div>
                  <p className="font-bold text-gray-900 mt-2">{topVotePlayer.firstName} {topVotePlayer.lastName}</p>
                  <p className="text-sm text-gray-500">{topVoteCount} voix sur {totalVotes} votant{totalVotes > 1 ? 's' : ''}</p>
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm mb-4">Aucun vote pour l'instant</p>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {myVote ? 'Votre vote :' : 'Voter pour la joueuse du match :'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(match.playerStats?.filter(s => s.minutesPlayed > 0) || []).map(s => {
                    const p = s.user;
                    if (!p) return null;
                    const votes = voteCounts[p.id] || 0;
                    const isSelected = myVote === p.id;
                    return (
                      <button key={p.id} onClick={() => handleVote(p.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-sm transition-all ${
                          isSelected ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-gray-200 hover:border-primary-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-700'}`}>
                          {p.firstName[0]}{p.lastName[0]}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="font-medium text-gray-900 truncate">{p.firstName} {p.lastName}</p>
                          {votes > 0 && <p className="text-xs text-gray-400">{votes} vote{votes > 1 ? 's' : ''}</p>}
                        </div>
                        {isSelected && <span className="ml-auto text-yellow-500">⭐</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Note du match */}
          {isPast && (
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-3">⭐ Note du match</h2>
              {avgRating !== null && (
                <div className="text-center mb-3">
                  <p className="text-3xl font-bold text-gray-900">{avgRating.toFixed(1)} <span className="text-lg text-gray-400">/ 5</span></p>
                  <div className="flex justify-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={`text-2xl ${s <= avgRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{match.ratings.length} vote{match.ratings.length > 1 ? 's' : ''}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{myRating ? 'Votre note :' : 'Notez ce match :'}</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => handleRate(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-3xl transition-transform hover:scale-125">
                      <span className={(hoverRating || myRating) >= s ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes du coach */}
          {match.notes && (
            <div className="card">
              <h2 className="font-bold text-gray-900 mb-2">📝 Notes</h2>
              <p className="text-gray-600 text-sm italic">"{match.notes}"</p>
            </div>
          )}
        </div>
      )}

      {/* JOUEUSES TAB */}
      {activeTab === 'joueuses' && (
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">
            Joueuses ({(match.playerStats?.filter(s => s.minutesPlayed > 0) || []).length})
          </h2>
          {starters.length === 0 && subs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Aucune joueuse enregistrée</p>
          ) : (
            <div className="space-y-3">
              {starters.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Titulaires</p>
                  {starters.map(s => <PlayerRow key={s.id} stat={s} myVote={myVote} topVoteId={topVoteId} />)}
                </>
              )}
              {subs.length > 0 && (
                <>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-3">Remplaçantes</p>
                  {subs.map(s => <PlayerRow key={s.id} stat={s} myVote={myVote} topVoteId={topVoteId} />)}
                </>
              )}
            </div>
          )}
          {isCoach && (
            <button onClick={openStatsForm} className="btn-primary w-full mt-4">
              {match.playerStats?.length ? 'Modifier les stats' : 'Saisir les stats'}
            </button>
          )}
        </div>
      )}

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {isCoach && (
            <button onClick={openStatsForm} className="btn-primary w-full">
              {match.playerStats?.length ? 'Modifier les statistiques' : 'Saisir les statistiques'}
            </button>
          )}
          {match.playerStats && match.playerStats.length > 0 ? (
            <div className="card overflow-x-auto">
              <h2 className="font-bold text-gray-900 mb-3">Tableau des stats</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="text-left py-2 pr-3">Joueuse</th>
                    <th className="text-center px-2">Min.</th>
                    <th className="text-center px-2">⚽</th>
                    <th className="text-center px-2">🎯</th>
                    <th className="text-center px-2">🟨</th>
                    <th className="text-center px-2">🟥</th>
                    <th className="text-center px-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...starters, ...subs].map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-xs font-semibold text-primary-700">
                            {s.user?.firstName?.[0]}{s.user?.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-xs">{s.user?.firstName} {s.user?.lastName}</p>
                            {s.user?.position && <p className="text-xs text-gray-400">{s.user.position}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-2 text-gray-700">{s.minutesPlayed}'</td>
                      <td className="text-center px-2 font-bold">{s.goals || '—'}</td>
                      <td className="text-center px-2">{s.assists || '—'}</td>
                      <td className="text-center px-2">{s.yellowCards > 0 ? s.yellowCards : '—'}</td>
                      <td className="text-center px-2">{s.redCards > 0 ? s.redCards : '—'}</td>
                      <td className="text-center px-2">
                        {s.rating ? (
                          <span className={`font-bold ${s.rating >= 7 ? 'text-green-600' : s.rating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {s.rating}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-gray-400">Aucune statistique saisie pour ce match</p>
            </div>
          )}
        </div>
      )}

      {/* Modal saisie stats */}
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
                      <th className="text-center py-2 px-2 font-medium text-gray-700">Note /10</th>
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
              <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4">
                <button onClick={handleSaveStats} disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
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

function PlayerRow({ stat, myVote, topVoteId }: { stat: PlayerMatchStat; myVote: string; topVoteId?: string }) {
  const p = stat.user;
  if (!p) return null;
  const isMvp = p.id === topVoteId;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${isMvp ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm relative ${isMvp ? 'bg-yellow-400 text-white' : 'bg-primary-100 text-primary-700'}`}>
        {p.firstName[0]}{p.lastName[0]}
        {isMvp && <span className="absolute -top-1 -right-1 text-xs">👑</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 text-sm">{p.firstName} {p.lastName}</p>
          {stat.starter && <span className="badge-blue text-xs">Titulaire</span>}
          {myVote === p.id && <span className="badge-yellow text-xs">⭐ Mon vote</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          <span>{stat.minutesPlayed}'</span>
          {stat.goals > 0 && <span>⚽ {stat.goals}</span>}
          {stat.assists > 0 && <span>🎯 {stat.assists}</span>}
          {stat.yellowCards > 0 && <span>🟨 {stat.yellowCards}</span>}
          {stat.redCards > 0 && <span>🟥 {stat.redCards}</span>}
        </div>
      </div>
      {stat.rating && (
        <div className={`text-sm font-bold px-2 py-1 rounded-lg ${stat.rating >= 7 ? 'bg-green-100 text-green-700' : stat.rating >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
          {stat.rating}
        </div>
      )}
    </div>
  );
}
