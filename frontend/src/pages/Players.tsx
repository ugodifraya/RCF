import { useEffect, useState } from 'react';
import api from '../services/api';
import { User, Injury } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Players() {
  const [players, setPlayers] = useState<User[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({ userId: '', type: '', startDate: '', endDate: '', description: '' });
  const [editInjury, setEditInjury] = useState<Injury | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'injuries'>('roster');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/users'),
      api.get('/injuries'),
    ]).then(([u, inj]) => {
      setPlayers(u.data.filter((user: User) => user.role === 'PLAYER'));
      setInjuries(inj.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSaveInjury = async () => {
    if (!injuryForm.userId || !injuryForm.type || !injuryForm.startDate) return;
    setSaving(true);
    try {
      if (editInjury) {
        await api.put(`/injuries/${editInjury.id}`, { ...injuryForm, status: editInjury.status });
      } else {
        await api.post('/injuries', injuryForm);
      }
      setShowInjuryForm(false);
      setEditInjury(null);
      setInjuryForm({ userId: '', type: '', startDate: '', endDate: '', description: '' });
      load();
    } catch { } finally { setSaving(false); }
  };

  const markRecovered = async (injury: Injury) => {
    await api.put(`/injuries/${injury.id}`, {
      userId: injury.userId,
      type: injury.type,
      startDate: injury.startDate,
      endDate: injury.endDate || new Date().toISOString().slice(0, 10),
      description: injury.description,
      status: 'RECOVERED',
    });
    load();
  };

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInjuryForm(prev => ({ ...prev, [f]: e.target.value }));

  const activeInjuries = injuries.filter(i => i.status === 'ACTIVE');
  const pastInjuries = injuries.filter(i => i.status === 'RECOVERED');

  if (loading) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Joueuses</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion de l'effectif et suivi des blessures</p>
        </div>
        <button onClick={() => { setEditInjury(null); setInjuryForm({ userId: '', type: '', startDate: '', endDate: '', description: '' }); setShowInjuryForm(true); }} className="btn-primary">
          + Déclarer une blessure
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab('roster')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'roster' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
          Effectif ({players.length})
        </button>
        <button onClick={() => setActiveTab('injuries')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'injuries' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
          Blessures {activeInjuries.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{activeInjuries.length}</span>}
        </button>
      </div>

      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map(p => {
            const playerInjuries = activeInjuries.filter(i => i.userId === p.id);
            return (
              <div key={p.id} className={`card hover:shadow-md transition-shadow ${playerInjuries.length > 0 ? 'border-red-200' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{p.firstName} {p.lastName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.position && <span className="text-xs text-gray-500">{p.position}</span>}
                      {p.number && <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">#{p.number}</span>}
                    </div>
                  </div>
                  {playerInjuries.length > 0 ? (
                    <span className="badge-red">Blessée</span>
                  ) : (
                    <span className="badge-green">Fit</span>
                  )}
                </div>
                {playerInjuries.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {playerInjuries.map(inj => (
                      <p key={inj.id} className="text-xs text-red-600">⚠️ {inj.type}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'injuries' && (
        <div className="space-y-4">
          {activeInjuries.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">Blessures actives ({activeInjuries.length})</h2>
              <div className="space-y-2">
                {activeInjuries.map(inj => (
                  <div key={inj.id} className="card border-red-200 bg-red-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-semibold text-sm">
                          {inj.user?.firstName?.[0]}{inj.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{inj.user?.firstName} {inj.user?.lastName}</p>
                          <p className="text-sm text-red-700 font-medium">{inj.type}</p>
                          <p className="text-xs text-gray-500">
                            Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })}
                            {inj.endDate && ` → ${format(new Date(inj.endDate), 'd MMMM yyyy', { locale: fr })}`}
                          </p>
                          {inj.description && <p className="text-xs text-gray-500 mt-1">{inj.description}</p>}
                        </div>
                      </div>
                      <button onClick={() => markRecovered(inj)} className="btn-secondary text-xs py-1 px-2 text-green-700 border-green-300 hover:bg-green-50">
                        Rétablie ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastInjuries.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Historique ({pastInjuries.length})</h2>
              <div className="space-y-2">
                {pastInjuries.map(inj => (
                  <div key={inj.id} className="card opacity-70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-sm">
                          {inj.user?.firstName?.[0]}{inj.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{inj.user?.firstName} {inj.user?.lastName} — {inj.type}</p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(inj.startDate), 'd MMM', { locale: fr })}
                            {inj.endDate && ` → ${format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}`}
                          </p>
                        </div>
                      </div>
                      <span className="badge-green">Rétablie</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {injuries.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-4xl mb-2">💪</p>
              <p className="text-gray-500">Aucune blessure déclarée</p>
            </div>
          )}
        </div>
      )}

      {showInjuryForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Déclarer une blessure</h2>
              <button onClick={() => setShowInjuryForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Joueuse *</label>
                <select className="input" value={injuryForm.userId} onChange={set('userId')}>
                  <option value="">Choisir une joueuse...</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type de blessure *</label>
                <input className="input" value={injuryForm.type} onChange={set('type')} placeholder="Ex: Entorse cheville, déchirure..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date de début *</label>
                  <input type="date" className="input" value={injuryForm.startDate} onChange={set('startDate')} />
                </div>
                <div>
                  <label className="label">Retour prévu</label>
                  <input type="date" className="input" value={injuryForm.endDate} onChange={set('endDate')} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} value={injuryForm.description} onChange={set('description')} placeholder="Détails de la blessure..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveInjury} disabled={saving || !injuryForm.userId || !injuryForm.type || !injuryForm.startDate} className="btn-primary flex-1">
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button onClick={() => setShowInjuryForm(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
