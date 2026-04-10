import { useEffect, useState } from 'react';
import api from '../services/api';
import { CycleTracking } from '../types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function HealthTracking() {
  const [cycles, setCycles] = useState<CycleTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCycle, setEditCycle] = useState<CycleTracking | null>(null);
  const [form, setForm] = useState({ startDate: '', endDate: '', painLevel: '', notes: '', shareWithCoach: false });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/health/my-cycles').then(r => setCycles(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.startDate) return;
    setSaving(true);
    try {
      const payload = { ...form, painLevel: form.painLevel || undefined };
      if (editCycle) {
        await api.put(`/health/cycles/${editCycle.id}`, payload);
      } else {
        await api.post('/health/cycles', payload);
      }
      setShowForm(false);
      setEditCycle(null);
      setForm({ startDate: '', endDate: '', painLevel: '', notes: '', shareWithCoach: false });
      load();
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return;
    await api.delete(`/health/cycles/${id}`);
    load();
  };

  const openEdit = (c: CycleTracking) => {
    setEditCycle(c);
    setForm({
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate?.slice(0, 10) || '',
      painLevel: c.painLevel?.toString() || '',
      notes: c.notes || '',
      shareWithCoach: (c as CycleTracking & { shareWithCoach?: boolean }).shareWithCoach || false,
    });
    setShowForm(true);
  };

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }));

  const painColors = ['', 'bg-green-500', 'bg-green-400', 'bg-lime-400', 'bg-yellow-400', 'bg-yellow-500', 'bg-orange-400', 'bg-orange-500', 'bg-red-400', 'bg-red-500', 'bg-red-600'];
  const painLabel = (n: number) => n <= 2 ? 'Légère' : n <= 4 ? 'Modérée' : n <= 6 ? 'Notable' : n <= 8 ? 'Forte' : 'Très forte';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🩸</span> Suivi cycle & santé
          </h1>
          <p className="text-gray-500 text-sm mt-1">Notez vos périodes de règles et votre niveau de douleur</p>
        </div>
        <button onClick={() => { setEditCycle(null); setForm({ startDate: '', endDate: '', painLevel: '', notes: '', shareWithCoach: false }); setShowForm(true); }} className="btn-primary">
          + Nouvelle entrée
        </button>
      </div>

      <div className="card bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
        <p className="text-sm text-pink-800">
          <strong>🔒 Confidentiel :</strong> Ces informations sont strictement privées. Vous pouvez choisir de partager votre état avec le coach (sans les détails de douleur) pour qu'il en tienne compte dans la gestion de l'équipe.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto" /></div>
      ) : cycles.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">🌸</p>
          <p className="text-gray-500">Aucune entrée enregistrée</p>
          <p className="text-sm text-gray-400 mt-1">Commencez à noter vos périodes pour mieux gérer votre forme</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(c => {
            const duration = c.endDate ? differenceInDays(new Date(c.endDate), new Date(c.startDate)) + 1 : null;
            const shared = (c as CycleTracking & { shareWithCoach?: boolean }).shareWithCoach;
            return (
              <div key={c.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-xl">🩸</div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {format(new Date(c.startDate), 'd MMMM yyyy', { locale: fr })}
                        {c.endDate && ` → ${format(new Date(c.endDate), 'd MMMM yyyy', { locale: fr })}`}
                      </p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {duration && <span className="text-xs text-gray-500">{duration} jour{duration > 1 ? 's' : ''}</span>}
                        {!c.endDate && <span className="badge-pink">En cours</span>}
                        {c.painLevel !== undefined && c.painLevel !== null && (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${painColors[c.painLevel]}`} />
                            <span className="text-xs text-gray-600">Douleur {c.painLevel}/10 — {painLabel(c.painLevel)}</span>
                          </div>
                        )}
                        {shared && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            👁 Partagé avec le coach
                          </span>
                        )}
                      </div>
                      {c.notes && <p className="text-sm text-gray-500 mt-1 italic">"{c.notes}"</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-gray-600 text-sm">Modifier</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editCycle ? 'Modifier' : 'Nouvelle entrée'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date de début *</label>
                  <input type="date" className="input" value={form.startDate} onChange={set('startDate')} />
                </div>
                <div>
                  <label className="label">Date de fin</label>
                  <input type="date" className="input" value={form.endDate} onChange={set('endDate')} />
                </div>
              </div>
              <div>
                <label className="label">Niveau de douleur : {form.painLevel ? `${form.painLevel}/10` : 'Non renseigné'}</label>
                <input type="range" min="0" max="10" step="1" value={form.painLevel || 0}
                  onChange={e => setForm(p => ({ ...p, painLevel: e.target.value }))}
                  className="w-full accent-pink-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Aucune douleur</span><span>Douleur extrême</span>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Comment vous sentez-vous ?" />
              </div>
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.shareWithCoach}
                    onChange={e => setForm(p => ({ ...p, shareWithCoach: e.target.checked }))}
                    className="mt-0.5 accent-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Informer le coach</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Le coach verra seulement que vous êtes en période (sans les détails de douleur). Utile pour adapter les entraînements.
                    </p>
                  </div>
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving || !form.startDate} className="btn-primary flex-1" style={{ background: '#db2777' }}>
                  {saving ? 'Enregistrement...' : editCycle ? 'Modifier' : 'Enregistrer'}
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
