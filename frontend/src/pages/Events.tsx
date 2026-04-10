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

export default function Events() {
  const { isCoach } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [form, setForm] = useState({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
          <p className="text-gray-500 text-sm mt-1">Entraînements, matchs et événements de l'équipe</p>
        </div>
        {isCoach && (
          <button onClick={() => { setEditEvent(null); setForm({ title: '', type: 'TRAINING', date: '', endDate: '', location: '', description: '' }); setShowForm(true); }} className="btn-primary">
            + Nouvel événement
          </button>
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
