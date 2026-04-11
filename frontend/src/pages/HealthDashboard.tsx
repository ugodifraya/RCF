import { useEffect, useState } from 'react';
import api from '../services/api';
import { Injury, User, CycleTracking } from '../types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const BODY_PARTS = ['Cheville', 'Genou', 'Cuisse', 'Dos', 'Épaule', 'Bras', 'Abducteurs', 'Mollet', 'Pied', 'Hanche', 'Nuque', 'Autre'];
const PAIN_COLORS = ['', 'bg-green-500', 'bg-green-400', 'bg-lime-400', 'bg-yellow-400', 'bg-yellow-500', 'bg-orange-400', 'bg-orange-500', 'bg-red-400', 'bg-red-500', 'bg-red-600'];
const PAIN_TEXT = ['', 'text-green-600', 'text-green-500', 'text-lime-500', 'text-yellow-500', 'text-yellow-600', 'text-orange-500', 'text-orange-600', 'text-red-500', 'text-red-600', 'text-red-700'];
const painLabel = (n: number) => n <= 2 ? 'Légère' : n <= 4 ? 'Modérée' : n <= 6 ? 'Notable' : n <= 8 ? 'Forte' : 'Très forte';

interface HealthData {
  summary: { totalPlayers: number; injuredCount: number; inCycleCount: number; availableCount: number };
  activeInjuries: (Injury & { user: User })[];
  recentInjuries: (Injury & { user: User })[];
  activeCycles: (CycleTracking & { user: User })[];
  allInjuries: (Injury & { user: User })[];
}

export default function HealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null);
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'injuries' | 'cycles' | 'history'>('overview');
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({ userId: '', type: '', bodyPart: '', startDate: '', endDate: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/health/dashboard'), api.get('/users/players')])
      .then(([h, p]) => { setData(h.data); setPlayers(p.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveInjury = async () => {
    if (!injuryForm.userId || !injuryForm.type || !injuryForm.startDate) return;
    setSaving(true);
    try {
      await api.post('/injuries', injuryForm);
      setShowInjuryForm(false);
      setInjuryForm({ userId: '', type: '', bodyPart: '', startDate: '', endDate: '', description: '' });
      load();
    } catch { } finally { setSaving(false); }
  };

  const markRecovered = async (injury: Injury) => {
    await api.put(`/injuries/${injury.id}`, {
      userId: injury.userId, type: injury.type, bodyPart: injury.bodyPart,
      startDate: injury.startDate, endDate: new Date().toISOString().slice(0, 10),
      description: injury.description, status: 'RECOVERED',
    });
    load();
  };

  const setI = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInjuryForm(p => ({ ...p, [f]: e.target.value }));

  if (loading) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;
  if (!data) return null;
  const { summary, activeInjuries, activeCycles, allInjuries } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><span>🏥</span> Santé équipe</h1>
          <p className="text-gray-500 text-sm mt-1">Blessures, cycles menstruels et état de forme</p>
        </div>
        <button onClick={() => setShowInjuryForm(true)} className="btn-primary">+ Déclarer blessure</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center bg-green-50 border-green-200">
          <p className="text-3xl font-bold text-green-600">{summary.availableCount}</p>
          <p className="text-sm text-gray-500 mt-1">Disponibles</p>
        </div>
        <div className={`card p-4 text-center ${summary.injuredCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
          <p className={`text-3xl font-bold ${summary.injuredCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{summary.injuredCount}</p>
          <p className="text-sm text-gray-500 mt-1">Blessées</p>
        </div>
        <div className={`card p-4 text-center ${summary.inCycleCount > 0 ? 'bg-pink-50 border-pink-200' : 'bg-gray-50'}`}>
          <p className={`text-3xl font-bold ${summary.inCycleCount > 0 ? 'text-pink-600' : 'text-gray-400'}`}>{summary.inCycleCount}</p>
          <p className="text-sm text-gray-500 mt-1">En période 🩸</p>
        </div>
        <div className="card p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-3xl font-bold text-blue-600">{summary.totalPlayers}</p>
          <p className="text-sm text-gray-500 mt-1">Total joueuses</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'overview', label: 'Vue d\'ensemble' },
          { key: 'injuries', label: `Blessures actives (${activeInjuries.length})` },
          { key: 'cycles', label: `Cycles actifs (${activeCycles.length})` },
          { key: 'history', label: 'Historique' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">🤕 Blessées en ce moment</h3>
            {activeInjuries.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Aucune blessure active 💪</p>
            ) : activeInjuries.map(inj => (
              <div key={inj.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl mb-2">
                <div className="flex items-center gap-2">
                  <Avatar user={inj.user} color="red" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName}</p>
                    <p className="text-xs text-red-600">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</p>
                    <p className="text-xs text-gray-400">{differenceInDays(new Date(), new Date(inj.startDate))} jour(s)</p>
                  </div>
                </div>
                <button onClick={() => markRecovered(inj)} className="text-xs text-green-700 border border-green-300 px-2 py-1 rounded-lg hover:bg-green-50">✓ Rétablie</button>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">🩸 Cycles actifs</h3>
            {activeCycles.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Aucun cycle actif déclaré</p>
            ) : activeCycles.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-pink-50 rounded-xl mb-2">
                <div className="flex items-center gap-2">
                  <Avatar user={c.user} color="pink" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.user.firstName} {c.user.lastName}</p>
                    <p className="text-xs text-gray-500">Depuis {format(new Date(c.startDate), 'd MMM', { locale: fr })}</p>
                  </div>
                </div>
                {c.painLevel !== undefined && c.painLevel !== null && c.painLevel > 0 && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <div className={`w-2 h-2 rounded-full ${PAIN_COLORS[c.painLevel]}`} />
                      <span className={`text-xs font-medium ${PAIN_TEXT[c.painLevel]}`}>{c.painLevel}/10</span>
                    </div>
                    <p className="text-xs text-gray-400">{painLabel(c.painLevel)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLESSURES ACTIVES */}
      {tab === 'injuries' && (
        <div className="space-y-3">
          {activeInjuries.length === 0 ? (
            <div className="card text-center py-10"><p className="text-4xl mb-2">💪</p><p className="text-gray-500">Aucune blessure active</p></div>
          ) : activeInjuries.map(inj => (
            <div key={inj.id} className="card border-red-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Avatar user={inj.user} color="red" size="lg" />
                  <div>
                    <p className="font-semibold text-gray-900">{inj.user.firstName} {inj.user.lastName}</p>
                    {inj.user.position && <p className="text-xs text-gray-400">{inj.user.position}</p>}
                    <p className="text-sm font-medium text-red-600 mt-1">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</p>
                    <p className="text-xs text-gray-500">Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })} ({differenceInDays(new Date(), new Date(inj.startDate))} j)</p>
                    {inj.endDate && <p className="text-xs text-gray-400">Retour prévu : {format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}</p>}
                    {inj.description && <p className="text-xs text-gray-500 italic mt-1">{inj.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Déclarée par : {inj.reportedBy === 'PLAYER' ? 'la joueuse' : 'le staff'}</p>
                  </div>
                </div>
                <button onClick={() => markRecovered(inj)} className="btn-secondary text-xs py-1 px-2 text-green-700 border-green-300 hover:bg-green-50 shrink-0">✓ Rétablie</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CYCLES ACTIFS DÉTAIL */}
      {tab === 'cycles' && (
        <div className="space-y-3">
          {activeCycles.length === 0 ? (
            <div className="card text-center py-10"><p className="text-4xl mb-2">🌸</p><p className="text-gray-500">Aucun cycle actif déclaré</p></div>
          ) : activeCycles.map(c => (
            <div key={c.id} className="card border-pink-200">
              <div className="flex items-center gap-4">
                <Avatar user={c.user} color="pink" size="lg" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{c.user.firstName} {c.user.lastName}</p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500">
                      Début : {format(new Date(c.startDate), 'd MMMM yyyy', { locale: fr })}
                    </span>
                    {c.endDate && <span className="text-xs text-gray-500">Fin prévue : {format(new Date(c.endDate), 'd MMM', { locale: fr })}</span>}
                    <span className="text-xs text-gray-500">{differenceInDays(new Date(), new Date(c.startDate)) + 1}e jour</span>
                  </div>
                  {c.notes && <p className="text-xs text-gray-500 italic mt-1">"{c.notes}"</p>}
                </div>
                {c.painLevel !== undefined && c.painLevel !== null ? (
                  <div className="text-center shrink-0">
                    <div className={`text-2xl font-bold ${PAIN_TEXT[c.painLevel] || 'text-gray-400'}`}>{c.painLevel}/10</div>
                    <div className="flex items-center gap-1 justify-center mt-0.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${PAIN_COLORS[c.painLevel]}`} />
                      <p className="text-xs text-gray-400">{c.painLevel > 0 ? painLabel(c.painLevel) : 'Aucune'}</p>
                    </div>
                    <p className="text-xs text-gray-400">douleur</p>
                  </div>
                ) : <span className="badge-gray shrink-0">Non renseigné</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORIQUE */}
      {tab === 'history' && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Historique des blessures</h3>
          <div className="space-y-2">
            {allInjuries.map(inj => (
              <div key={inj.id} className={`flex items-center justify-between p-3 rounded-xl ${inj.status === 'ACTIVE' ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  <Avatar user={inj.user} color={inj.status === 'ACTIVE' ? 'red' : 'gray'} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inj.user.firstName} {inj.user.lastName} — {inj.bodyPart ? `${inj.bodyPart} / ` : ''}{inj.type}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(inj.startDate), 'd MMM yyyy', { locale: fr })}
                      {inj.endDate && ` → ${format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}`}
                      {' · '}{inj.reportedBy === 'PLAYER' ? 'Auto-déclarée' : 'Staff'}
                    </p>
                  </div>
                </div>
                <span className={inj.status === 'ACTIVE' ? 'badge-red' : 'badge-green'}>{inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal déclaration blessure coach */}
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
                <select className="input" value={injuryForm.userId} onChange={setI('userId')}>
                  <option value="">Choisir une joueuse...</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Zone du corps</label>
                  <select className="input" value={injuryForm.bodyPart} onChange={setI('bodyPart')}>
                    <option value="">Choisir...</option>
                    {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Type de blessure *</label>
                  <input className="input" value={injuryForm.type} onChange={setI('type')} placeholder="Entorse, déchirure..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date début *</label><input type="date" className="input" value={injuryForm.startDate} onChange={setI('startDate')} /></div>
                <div><label className="label">Retour prévu</label><input type="date" className="input" value={injuryForm.endDate} onChange={setI('endDate')} /></div>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={injuryForm.description} onChange={setI('description')} placeholder="Contexte, gravité..." /></div>
              <div className="flex gap-2">
                <button onClick={saveInjury} disabled={saving || !injuryForm.userId || !injuryForm.type || !injuryForm.startDate} className="btn-primary flex-1">
                  {saving ? 'Enregistrement...' : 'Déclarer'}
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

function Avatar({ user, color, size = 'sm' }: { user: { firstName: string; lastName: string; avatarUrl?: string }; color: string; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const colors: Record<string, string> = { red: 'bg-red-100 text-red-600', pink: 'bg-pink-100 text-pink-600', gray: 'bg-gray-200 text-gray-500' };
  if (user.avatarUrl) return <img src={user.avatarUrl} className={`${sz} rounded-full object-cover shrink-0`} alt="" />;
  return (
    <div className={`${sz} ${colors[color] || colors.gray} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {user.firstName[0]}{user.lastName[0]}
    </div>
  );
}
