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
  confirmedAt?: string | null;
  voter: { id: string; firstName: string; lastName: string };
  votedFor: { id: string; firstName: string; lastName: string };
}
interface MatchRating {
  id: string; matchId: string; userId: string; rating: number;
  confirmedAt?: string | null;
  user?: { id: string; firstName: string; lastName: string };
}

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
  const [myVoteConfirmed, setMyVoteConfirmed] = useState(false);
  const [myRatingConfirmed, setMyRatingConfirmed] = useState(false);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState<number>(0);
  const [showVotesModal, setShowVotesModal] = useState(false);

  const load = () => {
    api.get(`/matches/${id}`).then(r => {
      const m: MatchFull = r.data;
      setMatch(m);
      const myV = m.playerVotes?.find(v => v.voterId === user?.id);
      if (myV) { setMyVote(myV.votedForId); setMyVoteConfirmed(!!myV.confirmedAt); }
      const myR = m.ratings?.find(r => r.userId === user?.id);
      if (myR) { setMyRating(myR.rating); setMyRatingConfirmed(!!myR.confirmedAt); }
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

  const handleVote = (votedForId: string) => {
    if (myVoteConfirmed) return;
    setPendingVote(votedForId);
  };

  const confirmVote = async () => {
    if (!pendingVote) return;
    await api.post(`/matches/${id}/vote`, { votedForId: pendingVote });
    await api.post(`/matches/${id}/vote/confirm`);
    setPendingVote(null);
    load();
  };

  const handleRate = (rating: number) => {
    if (myRatingConfirmed) return;
    setPendingRating(rating);
    setMyRating(rating);
  };

  const confirmRate = async () => {
    if (!pendingRating) return;
    await api.post(`/matches/${id}/rate`, { rating: pendingRating });
    await api.post(`/matches/${id}/rate/confirm`);
    setPendingRating(0);
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">
                    {myVoteConfirmed ? '✅ Vote confirmé (non modifiable)' : myVote ? 'Votre vote (non confirmé) :' : 'Voter pour la joueuse du match :'}
                  </p>
                  {isCoach && (
                    <button onClick={() => setShowVotesModal(true)} className="text-xs text-primary-600 hover:underline font-medium">
                      Voir tous les votes →
                    </button>
                  )}
                </div>
                {myVoteConfirmed && (
                  <p className="text-xs text-gray-400 mb-2">Votre vote a été confirmé et ne peut plus être modifié.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(match.playerStats?.filter(s => s.minutesPlayed > 0) || []).map(s => {
                    const p = s.user;
                    if (!p) return null;
                    const votes = voteCounts[p.id] || 0;
                    const isSelected = myVote === p.id;
                    return (
                      <button key={p.id} onClick={() => handleVote(p.id)}
                        disabled={myVoteConfirmed}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-sm transition-all ${
                          myVoteConfirmed
                            ? isSelected ? 'bg-yellow-50 border-yellow-400 opacity-80 cursor-default' : 'bg-white border-gray-200 opacity-50 cursor-default'
                            : isSelected ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-gray-200 hover:border-primary-300'
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
                {myVote && !myVoteConfirmed && (
                  <button onClick={() => setPendingVote(myVote)} className="btn-primary w-full mt-3 text-sm">
                    Confirmer mon vote
                  </button>
                )}
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
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {myRatingConfirmed ? '✅ Note confirmée (non modifiable)' : myRating ? 'Votre note (non confirmée) :' : 'Notez ce match :'}
                </p>
                {myRatingConfirmed && (
                  <p className="text-xs text-gray-400 mb-2">Votre note a été confirmée et ne peut plus être modifiée.</p>
                )}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s}
                      onClick={() => handleRate(s)}
                      onMouseEnter={() => !myRatingConfirmed && setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      disabled={myRatingConfirmed}
                      className={`text-3xl transition-transform ${myRatingConfirmed ? 'cursor-default' : 'hover:scale-125'}`}>
                      <span className={(hoverRating || myRating) >= s ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    </button>
                  ))}
                </div>
                {myRating > 0 && !myRatingConfirmed && (
                  <button onClick={() => setPendingRating(myRating)} className="btn-primary w-full mt-3 text-sm">
                    Confirmer ma note ({myRating}/5)
                  </button>
                )}
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

      {/* Dialog confirmation vote */}
      {pendingVote && (() => {
        const candidate = players.find(p => p.id === pendingVote);
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 text-center">Confirmer votre vote</h2>
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-bold text-xl mx-auto">
                  {candidate?.firstName[0]}{candidate?.lastName[0]}
                </div>
                <p className="mt-3 text-gray-700">
                  Vous votez pour <span className="font-semibold">{candidate?.firstName} {candidate?.lastName}</span>
                </p>
                <p className="text-sm text-red-500 mt-2 font-medium">⚠️ Cette action est définitive et ne pourra plus être modifiée.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPendingVote(null)} className="btn-secondary flex-1">Annuler</button>
                <button onClick={confirmVote} className="btn-primary flex-1">Confirmer</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Dialog confirmation note du match */}
      {pendingRating > 0 && !myRatingConfirmed && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 text-center">Confirmer votre note</h2>
            <div className="text-center">
              <div className="flex justify-center gap-1 my-3">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className={`text-3xl ${s <= pendingRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
              <p className="text-gray-700">Vous notez ce match <span className="font-semibold">{pendingRating}/5</span></p>
              <p className="text-sm text-red-500 mt-2 font-medium">⚠️ Cette action est définitive et ne pourra plus être modifiée.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPendingRating(0)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={confirmRate} className="btn-primary flex-1">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal coach : votes et notes par joueuse */}
      {showVotesModal && isCoach && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Votes et notes des joueuses</h2>
              <button onClick={() => setShowVotesModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-6">
              {/* Votes */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">🏆 Votes joueuse du match ({totalVotes} vote{totalVotes !== 1 ? 's' : ''})</h3>
                {match.playerVotes?.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun vote pour l'instant.</p>
                ) : (
                  <div className="space-y-2">
                    {match.playerVotes?.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-xs font-bold text-primary-700">
                            {v.voter.firstName[0]}{v.voter.lastName[0]}
                          </div>
                          <span className="text-gray-600">{v.voter.firstName} {v.voter.lastName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">→</span>
                          <span className="font-semibold text-gray-900">{v.votedFor.firstName} {v.votedFor.lastName}</span>
                          {v.confirmedAt
                            ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Confirmé</span>
                            : <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Non confirmé</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Notes */}
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">⭐ Notes du match ({match.ratings?.length ?? 0} note{(match.ratings?.length ?? 0) !== 1 ? 's' : ''})</h3>
                {match.ratings?.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune note pour l'instant.</p>
                ) : (
                  <div className="space-y-2">
                    {match.ratings?.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-xs font-bold text-primary-700">
                            {r.user?.firstName?.[0]}{r.user?.lastName?.[0]}
                          </div>
                          <span className="text-gray-600">{r.user?.firstName} {r.user?.lastName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <span key={s} className={`text-sm ${s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                            ))}
                          </div>
                          <span className="font-bold text-gray-900 w-8 text-right">{r.rating}/5</span>
                          {r.confirmedAt
                            ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Confirmé</span>
                            : <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Non confirmé</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {avgRating !== null && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-700">Moyenne équipe</span>
                    <span className="font-bold text-primary-900">{avgRating.toFixed(1)} / 5</span>
                  </div>
                )}
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
