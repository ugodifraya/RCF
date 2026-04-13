import { useEffect, useState } from 'react';
import api from '../services/api';
import { User, Injury } from '../types';

const POSITIONS = ['Gardienne', 'Défenseure centrale', 'Latérale droite', 'Latérale gauche', 'Milieu défensif', 'Milieu central', 'Milieu offensif', 'Ailière droite', 'Ailière gauche', 'Attaquante', 'Avant-centre'];

export default function Players() {
  const [players, setPlayers] = useState<User[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', password: '', position: '', birthDate: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [editPlayer, setEditPlayer] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', position: '', birthDate: '' });
  const [editSaving, setEditSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/injuries')])
      .then(([u, inj]) => {
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
      setAddForm({ firstName: '', lastName: '', email: '', password: '', position: '', birthDate: '' });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAddError(e?.response?.data?.error || 'Erreur lors de la création.');
    } finally { setAddSaving(false); }
  };

  const openEdit = (p: User) => {
    setEditPlayer(p);
    setEditForm({ firstName: p.firstName, lastName: p.lastName, email: p.email || '', position: p.position || '', birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '' });
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

  const setA = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAddForm(p => ({ ...p, [f]: e.target.value }));
  const setE = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(p => ({ ...p, [f]: e.target.value }));

  const activeInjuries = injuries.filter(i => i.status === 'ACTIVE');

  const getAge = (birthDate?: string | null) => {
    if (!birthDate) return null;
    const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
    return age;
  };

  if (loading) return <div className="text-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Joueuses</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion de l'effectif ({players.length} joueuse{players.length !== 1 ? 's' : ''})</p>
        </div>
        <button onClick={() => setShowAddPlayer(true)} className="btn-primary">
          + Ajouter une joueuse
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.length === 0 && (
          <div className="col-span-full card text-center py-10">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-gray-500">Aucune joueuse. Ajoutez votre effectif !</p>
          </div>
        )}
        {players.map(p => {
          const playerInjuries = activeInjuries.filter(i => i.userId === p.id);
          const age = getAge(p.birthDate);
          return (
            <div key={p.id} className={`card hover:shadow-md transition-shadow ${playerInjuries.length > 0 ? 'border-red-200' : ''}`}>
              <div className="flex items-center gap-3">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} className="w-12 h-12 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{p.firstName} {p.lastName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.position && <span className="text-xs text-gray-500">{p.position}</span>}
                    {age && <span className="text-xs text-gray-400">{age} ans</span>}
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

      {showAddPlayer && (
        <Modal title="Ajouter une joueuse" onClose={() => setShowAddPlayer(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Prénom *</label><input className="input" value={addForm.firstName} onChange={setA('firstName')} /></div>
              <div><label className="label">Nom *</label><input className="input" value={addForm.lastName} onChange={setA('lastName')} /></div>
            </div>
            <div><label className="label">Email *</label><input type="email" className="input" value={addForm.email} onChange={setA('email')} /></div>
            <div><label className="label">Mot de passe temporaire *</label><input type="password" className="input" value={addForm.password} onChange={setA('password')} placeholder="Elle pourra le changer après" /></div>
            <div><label className="label">Date de naissance</label><input type="date" className="input" value={addForm.birthDate} onChange={setA('birthDate')} /></div>
            <div>
              <label className="label">Poste</label>
              <select className="input" value={addForm.position} onChange={setA('position')}>
                <option value="">Choisir...</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
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

      {editPlayer && (
        <Modal title={`Modifier — ${editPlayer.firstName} ${editPlayer.lastName}`} onClose={() => setEditPlayer(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Prénom</label><input className="input" value={editForm.firstName} onChange={setE('firstName')} /></div>
              <div><label className="label">Nom</label><input className="input" value={editForm.lastName} onChange={setE('lastName')} /></div>
            </div>
            <div><label className="label">Email</label><input type="email" className="input" value={editForm.email} onChange={setE('email')} /></div>
            <div><label className="label">Date de naissance</label><input type="date" className="input" value={editForm.birthDate} onChange={setE('birthDate')} /></div>
            <div>
              <label className="label">Poste</label>
              <select className="input" value={editForm.position} onChange={setE('position')}>
                <option value="">Non défini</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleEditPlayer} disabled={editSaving} className="btn-primary flex-1">
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button onClick={() => setEditPlayer(null)} className="btn-secondary flex-1">Annuler</button>
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
