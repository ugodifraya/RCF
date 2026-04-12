import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Event, EventType, AttendanceStatus } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Présente', ABSENT: 'Absente', MAYBE: 'Peut-être', PENDING: 'En attente',
};
const STATUS_CLASSES: Record<AttendanceStatus, string> = {
  PRESENT: 'badge-green', ABSENT: 'badge-red', MAYBE: 'badge-yellow', PENDING: 'badge-gray',
};
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  TRAINING: 'Entraînement', MATCH: 'Match', OTHER: 'Événement',
};

interface ParsedMatch {
  title: string;
  date: string;
  location: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  isHome: boolean;
}

export default function Events() {
  const { isCoach } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [form, setForm] = useState({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  // FFF import state
  const [showFFFImport, setShowFFFImport] = useState(false);
  const [fffUrl, setFffUrl] = useState('');
  const [fffTeamName, setFffTeamName] = useState('RCF');
  const [fffLoading, setFffLoading] = useState(false);
  const [fffMatches, setFffMatches] = useState<ParsedMatch[]>([]);
  const [fffSelected, setFffSelected] = useState<Set<number>>(new Set());
  const [fffWarning, setFffWarning] = useState('');
  const [fffError, setFffError] = useState('');
  const [fffConfirming, setFffConfirming] = useState(false);
  const [fffStep, setFffStep] = useState<'input' | 'preview'>('input');

  const load = () => {
    setLoading(true);
    api.get('/events').then(r => setEvents(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = events.filter(e => {
    const d = new Date(e.date);
    if (filter === 'upcoming') return d >= new Date();
    if (filter === 'past') return d < new Date();
    return true;
  });

  const handleSave = async () => {
    if (!form.title || !form.date) return;
    setSaving(true);
    try {
      if (editEvent) {
        await api.put(`/events/${editEvent.id}`, form);
      } else {
        await api.post('/events', form);
      }
      setShowForm(false);
      setEditEvent(null);
      setForm({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' });
      load();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet événement ?')) return;
    await api.delete(`/events/${id}`);
    load();
  };

  const handleAttendance = async (eventId: string, status: AttendanceStatus) => {
    await api.post(`/events/${eventId}/attendance`, { status });
    load();
  };

  const openEdit = (event: Event) => {
    setEditEvent(event);
    setForm({
      title: event.title, type: event.type,
      date: event.date.slice(0, 16),
      endDate: event.endDate?.slice(0, 16) || '',
      location: event.location || '', description: event.description || '',
    });
    setShowForm(true);
  };

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }));

  // FFF import handlers
  const openFFFImport = () => {
    setFffUrl('');
    setFffTeamName('RCF');
    setFffMatches([]);
    setFffSelected(new Set());
    setFffWarning('');
    setFffError('');
    setFffStep('input');
    setShowFFFImport(true);
  };

  const handleFFFScrape = async () => {
    if (!fffUrl.trim()) return;
    setFffLoading(true);
    setFffError('');
    setFffWarning('');
    try {
      const res = await api.post('/events/import-fff', { url: fffUrl.trim(), teamName: fffTeamName.trim() || 'RCF' });
      setFffMatches(res.data.matches || []);
      setFffWarning(res.data.warning || '');
      // Select all by default
      setFffSelected(new Set((res.data.matches || []).map((_: ParsedMatch, i: number) => i)));
      setFffStep('preview');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setFffError(e?.response?.data?.error || 'Impossible de récupérer les matchs.');
    } finally {
      setFffLoading(false);
    }
  };

  const toggleFFFMatch = (i: number) => {
    setFffSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (fffSelected.size === fffMatches.length) {
      setFffSelected(new Set());
    } else {
      setFffSelected(new Set(fffMatches.map((_, i) => i)));
    }
  };

  const handleFFFConfirm = async () => {
    const selected = fffMatches.filter((_, i) => fffSelected.has(i));
    if (selected.length === 0) return;
    setFffConfirming(true);
    try {
      const res = await api.post('/events/import-fff/confirm', { matches: selected });
      setShowFFFImport(false);
      load();
      alert(`${res.data.created} match(s) importé(s) avec succès !`);
    } catch {
      setFffError('Erreur lors de l\'import. Réessayez.');
    } finally {
      setFffConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
          <p className="text-gray-500 text-sm mt-1">Entraînements, matchs et événements de l'équipe</p>
        </div>
        {isCoach && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={openFFFImport} className="btn-secondary">
              Importer depuis FFF
            </button>
            <button onClick={() => { setEditEvent(null); setForm({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' }); setShowForm(true); }} className="btn-primary">
              + Nouvel événement
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(['upcoming', 'all', 'past'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
            {f === 'upcoming' ? 'À venir' : f === 'past' ? 'Passés' : 'Tous'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500">Aucun événement {filter === 'upcoming' ? 'à venir' : filter === 'past' ? 'passé' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => (
            <div key={event.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  event.type === 'MATCH' ? 'bg-green-100' : event.type === 'TRAINING' ? 'bg-blue-100' : 'bg-purple-100'
                }`}>
                  {event.type === 'MATCH' ? '⚽' : event.type === 'TRAINING' ? '🏃' : '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {format(new Date(event.date), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                        {event.location && ` · ${event.location}`}
                      </p>
                    </div>
                    <span className={`badge-${event.type === 'MATCH' ? 'green' : event.type === 'TRAINING' ? 'blue' : 'pink'} shrink-0`}>
                      {EVENT_TYPE_LABELS[event.type]}
                    </span>
                  </div>
                  {event.description && <p className="text-sm text-gray-600 mt-2">{event.description}</p>}
                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                    {!isCoach && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Votre réponse :</span>
                        {(['PRESENT', 'MAYBE', 'ABSENT'] as AttendanceStatus[]).map(s => (
                          <button key={s} onClick={() => handleAttendance(event.id, s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              event.attendances?.[0]?.status === s
                                ? s === 'PRESENT' ? 'bg-green-600 text-white border-green-600'
                                  : s === 'ABSENT' ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-yellow-500 text-white border-yellow-500'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}>
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                    {isCoach && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{event._count?.attendances ?? 0} réponse(s)</span>
                        <button onClick={() => openEdit(event)} className="btn-secondary text-xs py-1 px-2">Modifier</button>
                        <button onClick={() => handleDelete(event.id)} className="btn-danger text-xs py-1 px-2">Supprimer</button>
                      </div>
                    )}
                    {!isCoach && event.attendances?.[0] && (
                      <span className={STATUS_CLASSES[event.attendances[0].status as AttendanceStatus]}>
                        {STATUS_LABELS[event.attendances[0].status as AttendanceStatus]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création / édition */}
      {showForm && (
        <Modal title={editEvent ? "Modifier l'événement" : 'Nouvel événement'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Titre *</label>
              <input className="input" value={form.title} onChange={set('title')} placeholder="Entraînement tactique" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type *</label>
                <select className="input" value={form.type} onChange={set('type')}>
                  <option value="TRAINING">Entraînement</option>
                  <option value="MATCH">Match</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Lieu</label>
                <input className="input" value={form.location} onChange={set('location')} placeholder="Stade..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date de début *</label>
                <input type="datetime-local" className="input" value={form.date} onChange={set('date')} />
              </div>
              <div>
                <label className="label">Date de fin</label>
                <input type="datetime-local" className="input" value={form.endDate} onChange={set('endDate')} />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={set('description')} placeholder="Détails de l'événement..." />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving || !form.title || !form.date} className="btn-primary flex-1">
                {saving ? 'Enregistrement...' : editEvent ? 'Modifier' : 'Créer'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal import FFF */}
      {showFFFImport && (
        <Modal title="Importer depuis FFF.fr" onClose={() => setShowFFFImport(false)}>
          {fffStep === 'input' ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                Collez l'URL de la page calendrier de votre équipe sur <strong>epreuves.fff.fr</strong> ou <strong>fff.fr</strong>.
              </div>
              <div>
                <label className="label">URL de la page FFF *</label>
                <input
                  className="input"
                  value={fffUrl}
                  onChange={e => setFffUrl(e.target.value)}
                  placeholder="https://epreuves.fff.fr/..."
                />
              </div>
              <div>
                <label className="label">Nom de l'équipe</label>
                <input
                  className="input"
                  value={fffTeamName}
                  onChange={e => setFffTeamName(e.target.value)}
                  placeholder="RCF"
                />
                <p className="text-xs text-gray-400 mt-1">Utilisé pour détecter si votre équipe joue à domicile ou à l'extérieur.</p>
              </div>
              {fffError && <p className="text-sm text-red-600">{fffError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleFFFScrape}
                  disabled={fffLoading || !fffUrl.trim()}
                  className="btn-primary flex-1"
                >
                  {fffLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Récupération...
                    </span>
                  ) : 'Récupérer les matchs'}
                </button>
                <button onClick={() => setShowFFFImport(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {fffWarning && (
                <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                  ⚠️ {fffWarning}
                </div>
              )}
              {fffMatches.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500">Aucun match trouvé sur cette page.</p>
                  <button onClick={() => setFffStep('input')} className="btn-secondary mt-3">Modifier l'URL</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">{fffMatches.length} match(s) trouvé(s) — {fffSelected.size} sélectionné(s)</p>
                    <button onClick={toggleAll} className="text-xs text-primary-600 hover:underline">
                      {fffSelected.size === fffMatches.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {fffMatches.map((m, i) => (
                      <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${fffSelected.has(i) ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={fffSelected.has(i)}
                          onChange={() => toggleFFFMatch(i)}
                          className="mt-0.5 accent-primary-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900">{m.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {format(new Date(m.date), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                            {m.location && ` · ${m.location}`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {m.competition && <span className="text-xs text-gray-400">{m.competition}</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.isHome ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {m.isHome ? 'Domicile' : 'Extérieur'}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {fffError && <p className="text-sm text-red-600">{fffError}</p>}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleFFFConfirm}
                      disabled={fffConfirming || fffSelected.size === 0}
                      className="btn-primary flex-1"
                    >
                      {fffConfirming ? 'Import...' : `Importer ${fffSelected.size} match(s)`}
                    </button>
                    <button onClick={() => setFffStep('input')} className="btn-secondary">Retour</button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
