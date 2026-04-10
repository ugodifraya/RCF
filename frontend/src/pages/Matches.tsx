import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Match, HomeAway } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const HOME_AWAY_LABELS: Record<HomeAway, string> = { HOME: 'Domicile', AWAY: 'Extérieur', NEUTRAL: 'Terrain neutre' };

function getResult(match: Match): { label: string; color: string } | null {
  if (match.scoreHome === null || match.scoreHome === undefined) return null;
  if (match.scoreAway === null || match.scoreAway === undefined) return null;
  const ours = match.homeAway === 'HOME' ? match.scoreHome : match.scoreAway;
  const theirs = match.homeAway === 'HOME' ? match.scoreAway : match.scoreHome;
  if (ours > theirs) return { label: 'V', color: 'bg-green-100 text-green-800' };
  if (ours < theirs) return { label: 'D', color: 'bg-red-100 text-red-800' };
  return { label: 'N', color: 'bg-gray-100 text-gray-800' };
}

export default function Matches() {
  const { isCoach } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [form, setForm] = useState({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/matches').then(r => setMatches(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.date || !form.opponent) return;
    setSaving(true);
    try {
      if (editMatch) {
        await api.put(`/matches/${editMatch.id}`, form);
      } else {
        await api.post('/matches', form);
      }
      setShowForm(false);
      setEditMatch(null);
      setForm({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' });
      load();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce match ?')) return;
    await api.delete(`/matches/${id}`);
    load();
  };

  const openEdit = (m: Match) => {
    setEditMatch(m);
    setForm({
      date: m.date.slice(0, 16), opponent: m.opponent,
      location: m.location || '', homeAway: m.homeAway,
      scoreHome: m.scoreHome?.toString() || '', scoreAway: m.scoreAway?.toString() || '',
      competition: m.competition || '', notes: m.notes || '',
    });
    setShowForm(true);
  };

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }));

  const upcoming = matches.filter(m => new Date(m.date) >= new Date());
  const past = matches.filter(m => new Date(m.date) < new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matchs</h1>
          <p className="text-gray-500 text-sm mt-1">Résultats et statistiques des matchs</p>
        </div>
        {isCoach && (
          <button onClick={() => { setEditMatch(null); setForm({ date: '', opponent: '', location: '', homeAway: 'HOME', scoreHome: '', scoreAway: '', competition: '', notes: '' }); setShowForm(true); }} className="btn-primary">
            + Nouveau match
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Prochains matchs</h2>
              <div className="space-y-3">
                {upcoming.map(m => <MatchCard key={m.id} match={m} isCoach={isCoach} onEdit={openEdit} onDelete={handleDelete} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Matchs joués</h2>
              <div className="space-y-3">
                {past.map(m => <MatchCard key={m.id} match={m} isCoach={isCoach} onEdit={openEdit} onDelete={handleDelete} />)}
              </div>
            </section>
          )}
          {matches.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-4xl mb-3">⚽</p>
              <p className="text-gray-500">Aucun match enregistré</p>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editMatch ? 'Modifier le match' : 'Nouveau match'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Adversaire *</label>
                <input className="input" value={form.opponent} onChange={set('opponent')} placeholder="FC Bordeaux" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input type="datetime-local" className="input" value={form.date} onChange={set('date')} />
                </div>
                <div>
                  <label className="label">Lieu</label>
                  <input className="input" value={form.location} onChange={set('location')} placeholder="Stade..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Domicile / Extérieur</label>
                  <select className="input" value={form.homeAway} onChange={set('homeAway')}>
                    <option value="HOME">Domicile</option>
                    <option value="AWAY">Extérieur</option>
                    <option value="NEUTRAL">Terrain neutre</option>
                  </select>
                </div>
                <div>
                  <label className="label">Compétition</label>
                  <input className="input" value={form.competition} onChange={set('competition')} placeholder="Championnat D2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Score {form.homeAway === 'HOME' ? 'RCF' : 'Adv'}</label>
                  <input type="number" min="0" className="input" value={form.scoreHome} onChange={set('scoreHome')} placeholder="0" />
                </div>
                <div>
                  <label className="label">Score {form.homeAway === 'HOME' ? 'Adv' : 'RCF'}</label>
                  <input type="number" min="0" className="input" value={form.scoreAway} onChange={set('scoreAway')} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} placeholder="Observations sur le match..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving || !form.date || !form.opponent} className="btn-primary flex-1">
                  {saving ? 'Enregistrement...' : editMatch ? 'Modifier' : 'Créer'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, isCoach, onEdit, onDelete }: { match: Match; isCoach: boolean; onEdit: (m: Match) => void; onDelete: (id: string) => void }) {
  const result = getResult(match);
  const isPast = new Date(match.date) < new Date();

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="text-center w-14">
          <p className="text-xs text-gray-400">{format(new Date(match.date), 'dd MMM', { locale: fr })}</p>
          <p className="text-xs text-gray-400">{format(new Date(match.date), 'HH:mm')}</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">RCF</span>
                {isPast && match.scoreHome !== null && match.scoreHome !== undefined ? (
                  <span className="font-bold text-lg mx-1">
                    {match.homeAway === 'HOME' ? match.scoreHome : match.scoreAway}
                    {' – '}
                    {match.homeAway === 'HOME' ? match.scoreAway : match.scoreHome}
                  </span>
                ) : (
                  <span className="text-gray-400 mx-1 text-sm">vs</span>
                )}
                <span className="font-semibold text-gray-900">{match.opponent}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${match.homeAway === 'HOME' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                  {HOME_AWAY_LABELS[match.homeAway as HomeAway]}
                </span>
                {match.competition && <span className="text-xs text-gray-400">{match.competition}</span>}
                {match.location && <span className="text-xs text-gray-400">· {match.location}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result && (
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${result.color}`}>
                  {result.label}
                </span>
              )}
              <Link to={`/matches/${match.id}`} className="btn-secondary text-xs py-1 px-3">Détails</Link>
              {isCoach && (
                <>
                  <button onClick={() => onEdit(match)} className="btn-secondary text-xs py-1 px-3">Modifier</button>
                  <button onClick={() => onDelete(match.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
