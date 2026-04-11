import { useEffect, useState } from 'react';
import api from '../services/api';
import { CycleTracking, Injury } from '../types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const BODY_PARTS = ['Cheville', 'Genou', 'Cuisse', 'Dos', 'Épaule', 'Bras', 'Abducteurs', 'Mollet', 'Pied', 'Hanche', 'Nuque', 'Autre'];
const PAIN_COLORS = ['', 'bg-green-500', 'bg-green-400', 'bg-lime-400', 'bg-yellow-400', 'bg-yellow-500', 'bg-orange-400', 'bg-orange-500', 'bg-red-400', 'bg-red-500', 'bg-red-600'];
const painLabel = (n: number) => n <= 2 ? 'Légère' : n <= 4 ? 'Modérée' : n <= 6 ? 'Notable' : n <= 8 ? 'Forte' : 'Très forte';

export default function HealthTracking() {
  const [tab, setTab] = useState<'cycle' | 'injury'>('cycle');
  const [cycles, setCycles] = useState<CycleTracking[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);

  // Cycle form
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [editCycle, setEditCycle] = useState<CycleTracking | null>(null);
  const [cycleForm, setCycleForm] = useState({ startDate: '', endDate: '', painLevel: '0', notes: '' });

  // Injury form
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({ type: '', bodyPart: '', startDate: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/health/my-cycles'),
      api.get('/injuries/my-injuries'),
    ]).then(([c, i]) => { setCycles(c.data); setInjuries(i.data); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveCycle = async () => {
    if (!cycleForm.startDate) return;
    setSaving(true);
    try {
      const payload = { ...cycleForm, painLevel: parseInt(cycleForm.painLevel) || 0 };
      if (editCycle) await api.put(`/health/cycles/${editCycle.id}`, payload);
      else await api.post('/health/cycles', payload);
      setShowCycleForm(false); setEditCycle(null);
      setCycleForm({ startDate: '', endDate: '', painLevel: '0', notes: '' });
      load();
    } catch { } finally { setSaving(false); }
  };

  const deleteCycle = async (id: string) => {
    if (!confirm('Supprimer cette entrée ?')) return;
    await api.delete(`/health/cycles/${id}`); load();
  };

  const openEditCycle = (c: CycleTracking) => {
    setEditCycle(c);
    setCycleForm({ startDate: c.startDate.slice(0, 10), endDate: c.endDate?.slice(0, 10) || '', painLevel: c.painLevel?.toString() || '0', notes: c.notes || '' });
    setShowCycleForm(true);
  };

  const saveInjury = async () => {
    if (!injuryForm.type || !injuryForm.startDate) return;
    setSaving(true);
    try {
      await api.post('/injuries/self-report', injuryForm);
      setShowInjuryForm(false);
      setInjuryForm({ type: '', bodyPart: '', startDate: '', description: '' });
      load();
    } catch { } finally { setSaving(false); }
  };

  const setC = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCycleForm(p => ({ ...p, [f]: e.target.value }));
  const setI = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInjuryForm(p => ({ ...p, [f]: e.target.value }));

  const activeInjuries = injuries.filter(i => i.status === 'ACTIVE');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Santé personnelle</h1>
        <p className="text-gray-500 text-sm mt-1">Suivi de votre cycle et de vos blessures / douleurs</p>
      </div>

      {/* Alerte blessure active */}
      {activeInjuries.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-sm font-semibold text-red-700 mb-2">⚠️ Blessure(s) active(s)</p>
          {activeInjuries.map(inj => (
            <div key={inj.id} className="text-sm text-red-600">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-gray-200 p-1 gap-1">
        <button onClick={() => setTab('cycle')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'cycle' ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          🩸 Cycle menstruel
        </button>
        <button onClick={() => setTab('injury')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${tab === 'injury' ? 'bg-red-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
          🤕 Douleurs / Blessures
          {activeInjuries.length > 0 && <span className="bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5">{activeInjuries.length}</span>}
        </button>
      </div>

      {/* CYCLE TAB */}
      {tab === 'cycle' && (
        <div className="space-y-4">
          <div className="card bg-pink-50 border-pink-200">
            <p className="text-sm text-pink-800">
              🔒 Ces informations sont transmises à votre coach (avec le niveau de douleur) afin d'adapter vos entraînements et de mieux gérer votre charge physique.
            </p>
          </div>
          <div className="flex justify-end">
            <button onClick={() => { setEditCycle(null); setCycleForm({ startDate: '', endDate: '', painLevel: '0', notes: '' }); setShowCycleForm(true); }} className="btn-primary" style={{ background: '#ec4899' }}>
              + Nouvelle période
            </button>
          </div>
          {loading ? <Spinner /> : cycles.length === 0 ? (
            <EmptyState icon="🌸" text="Aucune période enregistrée" />
          ) : (
            <div className="space-y-3">
              {cycles.map(c => {
                const duration = c.endDate ? differenceInDays(new Date(c.endDate), new Date(c.startDate)) + 1 : null;
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
                            {c.painLevel !== undefined && c.painLevel !== null && c.painLevel > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${PAIN_COLORS[c.painLevel]}`} />
                                <span className="text-xs text-gray-600">Douleur {c.painLevel}/10 — {painLabel(c.painLevel)}</span>
                              </div>
                            )}
                          </div>
                          {c.notes && <p className="text-xs text-gray-500 mt-1 italic">"{c.notes}"</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openEditCycle(c)} className="text-gray-400 hover:text-gray-600 text-sm">Modifier</button>
                        <button onClick={() => deleteCycle(c.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* INJURY TAB */}
      {tab === 'injury' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setInjuryForm({ type: '', bodyPart: '', startDate: '', description: '' }); setShowInjuryForm(true); }} className="btn-primary" style={{ background: '#ef4444' }}>
              + Signaler une douleur / blessure
            </button>
          </div>
          {loading ? <Spinner /> : injuries.length === 0 ? (
            <EmptyState icon="💪" text="Aucune blessure déclarée" />
          ) : (
            <div className="space-y-3">
              {injuries.map(inj => (
                <div key={inj.id} className={`card ${inj.status === 'ACTIVE' ? 'border-red-200 bg-red-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${inj.status === 'ACTIVE' ? 'bg-red-100' : 'bg-gray-100'}`}>
                        {inj.status === 'ACTIVE' ? '🤕' : '✅'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</p>
                        <p className="text-xs text-gray-500">
                          Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })}
                          {inj.endDate && ` · Retour prévu : ${format(new Date(inj.endDate), 'd MMM', { locale: fr })}`}
                        </p>
                        {inj.description && <p className="text-xs text-gray-400 italic mt-0.5">"{inj.description}"</p>}
                        <p className="text-xs text-gray-400 mt-0.5">Déclaré par : {inj.reportedBy === 'PLAYER' ? 'vous-même' : 'le staff'}</p>
                      </div>
                    </div>
                    <span className={inj.status === 'ACTIVE' ? 'badge-red' : 'badge-green'}>
                      {inj.status === 'ACTIVE' ? 'Active' : 'Rétablie'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal cycle */}
      {showCycleForm && (
        <Modal title={editCycle ? 'Modifier la période' : 'Nouvelle période'} onClose={() => setShowCycleForm(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Début *</label><input type="date" className="input" value={cycleForm.startDate} onChange={setC('startDate')} /></div>
              <div><label className="label">Fin</label><input type="date" className="input" value={cycleForm.endDate} onChange={setC('endDate')} /></div>
            </div>
            <div>
              <label className="label">Niveau de douleur : {cycleForm.painLevel}/10{parseInt(cycleForm.painLevel) > 0 ? ` — ${painLabel(parseInt(cycleForm.painLevel))}` : ' — Aucune'}</label>
              <input type="range" min="0" max="10" step="1" value={cycleForm.painLevel} onChange={setC('painLevel')} className="w-full accent-pink-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Aucune</span><span>Extrême</span></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={cycleForm.notes} onChange={setC('notes')} placeholder="Symptômes, ressenti..." /></div>
            <div className="flex gap-2">
              <button onClick={saveCycle} disabled={saving || !cycleForm.startDate} className="btn-primary flex-1" style={{ background: '#ec4899' }}>
                {saving ? 'Enregistrement...' : editCycle ? 'Modifier' : 'Enregistrer'}
              </button>
              <button onClick={() => setShowCycleForm(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal blessure */}
      {showInjuryForm && (
        <Modal title="Signaler une douleur / blessure" onClose={() => setShowInjuryForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Zone concernée</label>
              <select className="input" value={injuryForm.bodyPart} onChange={setI('bodyPart')}>
                <option value="">Choisir...</option>
                {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type de douleur / blessure *</label>
              <input className="input" value={injuryForm.type} onChange={setI('type')} placeholder="Ex: Douleur, entorse, contracture..." />
            </div>
            <div>
              <label className="label">Date d'apparition *</label>
              <input type="date" className="input" value={injuryForm.startDate} onChange={setI('startDate')} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={injuryForm.description} onChange={setI('description')} placeholder="Décrivez vos symptômes, dans quelles circonstances..." />
            </div>
            <div className="flex gap-2">
              <button onClick={saveInjury} disabled={saving || !injuryForm.type || !injuryForm.startDate} className="btn-primary flex-1" style={{ background: '#ef4444' }}>
                {saving ? 'Envoi...' : 'Signaler'}
              </button>
              <button onClick={() => setShowInjuryForm(false)} className="btn-secondary flex-1">Annuler</button>
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
function Spinner() { return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>; }
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return <div className="card text-center py-10"><p className="text-4xl mb-2">{icon}</p><p className="text-gray-500">{text}</p></div>;
}
