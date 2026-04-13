import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface FFFClub { id: string; name: string; city: string; }
interface FFFTeam { id: string; name: string; category: string; }

type Step = 'role' | 'info' | 'fff';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'PLAYER' | 'COACH'>('PLAYER');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', position: '', number: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // FFF search state
  const [clubQuery, setClubQuery] = useState('');
  const [clubs, setClubs] = useState<FFFClub[]>([]);
  const [selectedClub, setSelectedClub] = useState<FFFClub | null>(null);
  const [teams, setTeams] = useState<FFFTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<FFFTeam | null>(null);
  const [fffSearching, setFffSearching] = useState(false);
  const [importing, setImporting] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSearchClub = async () => {
    if (clubQuery.length < 2) return;
    setFffSearching(true);
    setClubs([]); setSelectedClub(null); setTeams([]); setSelectedTeam(null);
    try {
      const res = await api.get(`/fff/search-clubs?q=${encodeURIComponent(clubQuery)}`);
      setClubs(res.data);
    } catch { setError('Impossible de rechercher les clubs FFF.'); }
    finally { setFffSearching(false); }
  };

  const handleSelectClub = async (club: FFFClub) => {
    setSelectedClub(club); setTeams([]); setSelectedTeam(null);
    try {
      const res = await api.get(`/fff/clubs/${club.id}/teams`);
      setTeams(res.data);
    } catch { setError('Impossible de récupérer les équipes.'); }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, role });
      // Si coach avec équipe FFF sélectionnée → importer le calendrier
      if (role === 'COACH' && selectedClub && selectedTeam) {
        setImporting(true);
        try {
          const calRes = await api.get(`/fff/clubs/${selectedClub.id}/teams/${selectedTeam.id}/calendar`);
          if (calRes.data?.length > 0) {
            await api.post('/fff/import', {
              clNo: selectedClub.id,
              eqNo: selectedTeam.id,
              matches: calRes.data,
              saveSettings: true,
              clubName: selectedClub.name,
              teamName: selectedTeam.name,
            });
          }
        } catch { /* Import silencieux — pas bloquant */ }
        finally { setImporting(false); }
      }
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Erreur lors de l'inscription");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary-700 font-bold text-2xl mx-auto mb-3 shadow-lg">R</div>
          <h1 className="text-2xl font-bold text-white">RCF Team Manager</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Étape 1 : Choix du rôle */}
          {step === 'role' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900 text-center">Bienvenue !</h2>
              <p className="text-gray-500 text-sm text-center">Vous êtes :</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setRole('PLAYER'); setStep('info'); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all">
                  <span className="text-4xl">⚽</span>
                  <span className="font-semibold text-gray-800">Joueuse</span>
                  <span className="text-xs text-gray-500 text-center">Accès à vos stats, présences et suivi santé</span>
                </button>
                <button
                  onClick={() => { setRole('COACH'); setStep('info'); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all">
                  <span className="text-4xl">🏟️</span>
                  <span className="font-semibold text-gray-800">Coach</span>
                  <span className="text-xs text-gray-500 text-center">Gestion de l'équipe, calendrier et santé</span>
                </button>
              </div>
              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary-600 hover:underline font-medium">Se connecter</Link>
              </p>
            </div>
          )}

          {/* Étape 2 : Informations personnelles */}
          {step === 'info' && (
            <form onSubmit={role === 'COACH' ? (e) => { e.preventDefault(); setStep('fff'); } : handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button type="button" onClick={() => setStep('role')} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
                <h2 className="text-xl font-bold text-gray-900">
                  {role === 'COACH' ? 'Votre profil coach' : 'Créer un compte joueuse'}
                </h2>
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prénom *</label><input className="input" value={form.firstName} onChange={set('firstName')} required placeholder="Emma" /></div>
                <div><label className="label">Nom *</label><input className="input" value={form.lastName} onChange={set('lastName')} required placeholder="Dupont" /></div>
              </div>
              <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={set('email')} required placeholder="vous@exemple.fr" /></div>
              <div><label className="label">Mot de passe *</label><input type="password" className="input" value={form.password} onChange={set('password')} required placeholder="Minimum 6 caractères" minLength={6} /></div>
              {role === 'PLAYER' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Poste</label>
                    <select className="input" value={form.position} onChange={set('position')}>
                      <option value="">Choisir...</option>
                      {['Gardienne','Défenseure centrale','Latérale droite','Latérale gauche','Milieu défensif','Milieu central','Ailière','Attaquante'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Numéro</label><input type="number" className="input" value={form.number} onChange={set('number')} placeholder="Ex: 9" min="1" max="99" /></div>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {role === 'COACH' ? 'Suivant → Sélectionner le club' : loading ? 'Création...' : 'Créer mon compte'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary-600 hover:underline font-medium">Se connecter</Link>
              </p>
            </form>
          )}

          {/* Étape 3 (coach) : Sélection du club FFF */}
          {step === 'fff' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <button type="button" onClick={() => setStep('info')} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
                <h2 className="text-xl font-bold text-gray-900">Votre club FFF</h2>
              </div>
              <p className="text-sm text-gray-500">Recherchez votre club pour importer automatiquement le calendrier de championnat.</p>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="label">Nom du club</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={clubQuery}
                    onChange={e => setClubQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchClub())}
                    placeholder="Ex: Racing Club de France..."
                  />
                  <button type="button" onClick={handleSearchClub} disabled={fffSearching || clubQuery.length < 2} className="btn-secondary px-4">
                    {fffSearching ? '...' : 'Chercher'}
                  </button>
                </div>
              </div>

              {clubs.length > 0 && !selectedClub && (
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {clubs.map(c => (
                    <button key={c.id} type="button" onClick={() => handleSelectClub(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-primary-50 text-sm border-b border-gray-100 last:border-0">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.city && <span className="text-gray-400 ml-2 text-xs">{c.city}</span>}
                    </button>
                  ))}
                </div>
              )}

              {selectedClub && (
                <div className="p-3 bg-primary-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-primary-800">{selectedClub.name}</p>
                    {selectedClub.city && <p className="text-xs text-primary-600">{selectedClub.city}</p>}
                  </div>
                  <button type="button" onClick={() => { setSelectedClub(null); setTeams([]); setSelectedTeam(null); }} className="text-primary-400 hover:text-primary-600 text-xs">Changer</button>
                </div>
              )}

              {teams.length > 0 && (
                <div>
                  <label className="label">Équipe</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    {teams.map(t => (
                      <button key={t.id} type="button" onClick={() => setSelectedTeam(t)}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 transition-colors ${selectedTeam?.id === t.id ? 'bg-primary-100 text-primary-800 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}>
                        {t.name}
                        {t.category && <span className="text-gray-400 ml-2 text-xs">{t.category}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTeam && (
                <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">
                  ✓ Le championnat de <strong>{selectedTeam.name}</strong> sera importé automatiquement après l'inscription.
                </div>
              )}

              {importing && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full" />
                  Import du calendrier en cours...
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading || importing} className="btn-primary flex-1">
                  {loading ? 'Création...' : importing ? 'Import...' : selectedTeam ? 'Créer le compte et importer' : 'Créer le compte'}
                </button>
                <button type="button" onClick={() => { setSelectedClub(null); setSelectedTeam(null); handleSubmit({ preventDefault: () => {} } as FormEvent); }}
                  className="btn-secondary text-xs px-3">
                  Passer
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
