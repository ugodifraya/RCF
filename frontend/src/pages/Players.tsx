import { useEffect, useState } from 'react';
import api from '../services/api';
import { User, Injury } from '../types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

const BODY_PARTS = ['Cheville', 'Genou', 'Cuisse', 'Dos', 'Épaule', 'Bras', 'Abducteurs', 'Mollet', 'Pied', 'Hanche', 'Nuque', 'Autre'];
const POSITIONS = ['Gardienne', 'Défenseure centrale', 'Latérale droite', 'Latérale gauche', 'Milieu défensif', 'Milieu central', 'Milieu offensif', 'Ailière droite', 'Ailière gauche', 'Attaquante', 'Avant-centre'];

export default function Players() {
  const [players, setPlayers] = useState<User[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'injuries'>('roster');

  // Add player modal
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', password: '', position: '', number: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit player modal
  const [editPlayer, setEditPlayer] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', position: '', number: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Declare injury modal
  const [showInjuryForm, setShowInjuryForm] = useState(false);
  const [injuryForm, setInjuryForm] = useState({ userId: '', type: '', bodyPart: '', startDate: '', endDate: '', description: '' });
  const [injurySaving, setInjurySaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/users'),
      api.get('/injuries'),
    ]).then(([u, inj]) => {
      setPlayers(u.data.filter((user: User) => user.role === 'PLAYER'));
      setInjuries(inj.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAddPlayer = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.email || !addForm.password) return;
    setAddSaving(true); setAddError('');
    try {
      await api.post('/users', addForm);
      setShowAddPlayer(false);
      setAddForm({ firstName: '', lastName: '', email: '', password: '', position: '', number: '' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAddError(e?.response?.data?.error || 'Erreur lors de la création.');
    } finally { setAddSaving(false); }
  };

  const openEdit = (p: User) => {
    setEditPlayer(p);
    setEditForm({ firstName: p.firstName, lastName: p.lastName, email: p.email || '', position: p.position || '', number: p.number?.toString() || '' });
  };

  const handleEditPlayer = async () => {
    if (!editPlayer) return;
    setEditSaving(true);
    try {
      await api.patch(`/users/${editPlayer.id}`, editForm);
      setEditPlayer(null);
      load();
    } catch { } finally { setEditSaving(false); }
  };

  const handleSaveInjury = async () => {
    if (!injuryForm.userId || !injuryForm.type || !injuryForm.startDate) return;
    setInjurySaving(true);
    try {
      await api.post('/injuries', injuryForm);
      setShowInjuryForm(false);
      setInjuryForm({ userId: '', type: '', bodyPart: '', startDate: '', endDate: '', description: '' });
      load();
    } catch { } finally { setInjurySaving(false); }
  };

  const markRecovered = async (injury: Injury) => {
    await api.put(`/injuries/${injury.id}`, {
      type: injury.type, bodyPart: injury.bodyPart,
      startDate: injury.startDate,
      endDate: new Date().toISOString().slice(0, 10),
      description: injury.description,
      status: 'RECOVERED',
    });
    load();
  };

  const setA = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddForm(p => ({ ...p, [f]: e.target.value }));
  const setE = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(p => ({ ...p, [f]: e.target.value }));
  const setInj = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInjuryForm(p => ({ ...p, [f]: e.target.value }));

  const activeInjuries = injuries.filter(i => i.status === 'ACTIVE');
  const pastInjuries = injuries.filter(i => i.status === 'RECOVERED');

  if (loading) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Joueuses</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion de l'effectif et suivi des blessures</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowInjuryForm(true); }} className="btn-primary bg-red-500 hover:bg-red-600">
            + Déclarer une blessure
          </button>
          <button onClick={() => setShowAddPlayer(true)} className="btn-primary">
            + Ajouter une joueuse
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab('roster')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'roster' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
          Effectif ({players.length})
        </button>
        <button onClick={() => setActiveTab('injuries')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'injuries' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>
          Blessures {activeInjuries.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{activeInjuries.length}</span>}
        </button>
      </div>

      {/* EFFECTIF */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.length === 0 && (
            <div className="col-span-full card text-center py-10">
              <p className="text-4xl mb-2">👥</p>
              <p className="text-gray-500">Aucune joueuse. Ajoutez votre effectif !</p>
            </div>
          )}
          {players.map(p => {
            const playerInjuries = activeInjuries.filter(i => i.userId === p.id);
            return (
              <div key={p.id} className={`card hover:shadow-md transition-shadow ${playerInjuries.length > 0 ? 'border-red-200' : ''}`}>
                <div className="flex items-center gap-3">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} className="w-12 h-12 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{p.firstName} {p.lastName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.position && <span className="text-xs text-gray-500">{p.position}</span>}
                      {p.number && <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">#{p.number}</span>}
                    </div>
                    {p.email && <p className="text-xs text-gray-400 truncate mt-0.5">{p.email}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {playerInjuries.length > 0 ? (
                      <span className="badge-red">Blessée</span>
                    ) : (
                      <span className="badge-green">Fit</span>
                    )}
                    <button onClick={() => openEdit(p)} className="text-xs text-primary-600 hover:underline">Modifier</button>
                  </div>
                </div>
                {playerInjuries.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {playerInjuries.map(inj => (
                      <p key={inj.id} className="text-xs text-red-600">⚠️ {inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BLESSURES */}
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
                        <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-semibold text-sm shrink-0">
                          {inj.user?.firstName?.[0]}{inj.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{inj.user?.firstName} {inj.user?.lastName}</p>
                          <p className="text-sm text-red-700 font-medium">{inj.bodyPart ? `${inj.bodyPart} — ` : ''}{inj.type}</p>
                          <p className="text-xs text-gray-500">
                            Depuis le {format(new Date(inj.startDate), 'd MMMM yyyy', { locale: fr })}
                            {' '}({differenceInDays(new Date(), new Date(inj.startDate))} j)
                          </p>
                          {inj.endDate && <p className="text-xs text-gray-400">Retour prévu : {format(new Date(inj.endDate), 'd MMM yyyy', { locale: fr })}</p>}
                          {inj.description && <p className="text-xs text-gray-500 mt-1">{inj.description}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {inj.reportedBy === 'PLAYER' ? '🙋 Auto-déclarée' : '👤 Déclarée par le staff'}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => markRecovered(inj)} className="btn-secondary text-xs py-1 px-2 text-green-700 border-green-300 hover:bg-green-50 shrink-0">
                        ✓ Rétablie
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
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-sm shrink-0">
                          {inj.user?.firstName?.[0]}{inj.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{inj.user?.firstName} {inj.user?.lastName} — {inj.bodyPart ? `${inj.bodyPart} / ` : ''}{inj.type}</p>
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

      {/* Modal ajout joueuse */}
      {showAddPlayer && (
        <Modal title="Ajouter une joueuse" onClose={() => setShowAddPlayer(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Prénom *</label><input className="input" value={addForm.firstName} onChange={setA('firstName')} /></div>
              <div><label className="label">Nom *</label><input className="input" value={addForm.lastName} onChange={setA('lastName')} /></div>
            </div>
            <div><label className="label">Email *</label><input type="email" className="input" value={addForm.email} onChange={setA('email')} /></div>
            <div><label className="label">Mot de passe temporaire *</label><input type="password" className="input" value={addForm.password} onChange={setA('password')} placeholder="Elle pourra le changer après" /></div>
            <div>
              <label className="label">Poste</label>
              <select className="input" value={addForm.position} onChange={setA('position')}>
                <option value="">Choisir...</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
            <div><label className="label">Numéro</label><input type="number" className="input" placeholder="Ex: 10" value={addForm.number} onChange={setA('number')} /></div>
            {addError && <p className="text-sm text-red-600">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddPlayer} disabled={addSaving || !addForm.firstName || !addForm.lastName || !addForm.email || !addForm.password} className="btn-primary flex-1">
                {addSaving ? 'Création...' : 'Créer le compte'}
              </button>
              <button onClick={() => setShowAddPlayer(false)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal édition joueuse */}
      {editPlayer && (
        <Modal title={`Modifier — ${editPlayer.firstName} ${editPlayer.lastName}`} onClose={() => setEditPlayer(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Prénom</label><input className="input" value={editForm.firstName} onChange={setE('firstName')} /></div>
              <div><label className="label">Nom</label><input className="input" value={editForm.lastName} onChange={setE('lastName')} /></div>
            </div>
            <div><label className="label">Email</label><input type="email" className="input" value={editForm.email} onChange={setE('email')} /></div>
            <div>
              <label className="label">Poste</label>
              <select className="input" value={editForm.position} onChange={setE('position')}>
                <option value="">Non défini</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
            <div><label className="label">Numéro</label><input type="number" className="input" value={editForm.number} onChange={setE('number')} /></div>
            <div className="flex gap-2">
              <button onClick={handleEditPlayer} disabled={editSaving} className="btn-primary flex-1">
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button onClick={() => setEditPlayer(null)} className="btn-secondary flex-1">Annuler</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal blessure */}
      {showInjuryForm && (
        <Modal title="Déclarer une blessure" onClose={() => setShowInjuryForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Joueuse *</label>
              <select className="input" value={injuryForm.userId} onChange={setInj('userId')}>
                <option value="">Choisir une joueuse...</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Zone du corps</label>
                <select className="input" value={injuryForm.bodyPart} onChange={setInj('bodyPart')}>
                  <option value="">Choisir...</option>
                  {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type de blessure *</label>
                <input className="input" value={injuryForm.type} onChange={setInj('type')} placeholder="Entorse, déchirure..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Date début *</label><input type="date" className="input" value={injuryForm.startDate} onChange={setInj('startDate')} /></div>
              <div><label className="label">Retour prévu</label><input type="date" className="input" value={injuryForm.endDate} onChange={setInj('endDate')} /></div>
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={3} value={injuryForm.description} onChange={setInj('description')} placeholder="Contexte, gravité..." /></div>
            <div className="flex gap-2">
              <button onClick={handleSaveInjury} disabled={injurySaving || !injuryForm.userId || !injuryForm.type || !injuryForm.startDate} className="btn-primary flex-1">
                {injurySaving ? 'Enregistrement...' : 'Déclarer'}
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
