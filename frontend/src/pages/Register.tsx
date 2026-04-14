import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Step = 'role' | 'info' | 'team';

const CATEGORIES = ['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','Seniors','Vétéranes'];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillCode = searchParams.get('code') || '';

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'PLAYER' | 'COACH'>('PLAYER');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', position: '', birthDate: '' });
  const [teamName, setTeamName] = useState('');
  const [teamCategory, setTeamCategory] = useState('');
  const [teamCode, setTeamCode] = useState(prefillCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleInfoNext = (e: FormEvent) => {
    e.preventDefault();
    if (role === 'COACH') { setStep('team'); return; }
    handleSubmit();
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await register({
        ...form,
        role,
        teamName: role === 'COACH' ? teamName : undefined,
        teamCategory: role === 'COACH' ? teamCategory : undefined,
        teamCode: role === 'PLAYER' && teamCode ? teamCode : undefined,
      });
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Erreur lors de l'inscription");
      if (role === 'COACH') setStep('team');
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

          {/* Étape 1 : Rôle */}
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
                  <span className="text-xs text-gray-500 text-center">Stats, présences et suivi santé</span>
                </button>
                <button
                  onClick={() => { setRole('COACH'); setStep('info'); }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all">
                  <span className="text-4xl">🏟️</span>
                  <span className="font-semibold text-gray-800">Coach</span>
                  <span className="text-xs text-gray-500 text-center">Gestion équipe, calendrier et santé</span>
                </button>
              </div>
              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary-600 hover:underline font-medium">Se connecter</Link>
              </p>
            </div>
          )}

          {/* Étape 2 : Infos personnelles */}
          {step === 'info' && (
            <form onSubmit={handleInfoNext} className="space-y-4">
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
              <div><label className="label">Date de naissance</label><input type="date" className="input" value={form.birthDate} onChange={set('birthDate')} max={new Date().toISOString().slice(0,10)} /></div>
              {role === 'PLAYER' && (
                <>
                  <div>
                    <label className="label">Poste</label>
                    <select className="input" value={form.position} onChange={set('position')}>
                      <option value="">Choisir...</option>
                      {['Gardienne','Défenseure centrale','Latérale droite','Latérale gauche','Milieu défensif','Milieu central','Ailière','Attaquante'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Code équipe <span className="text-gray-400 font-normal">(optionnel)</span></label>
                    <input className="input uppercase tracking-widest font-mono" value={teamCode} onChange={e => setTeamCode(e.target.value.toUpperCase())} placeholder="Ex: RCF3X7" maxLength={8} />
                    <p className="text-xs text-gray-400 mt-1">Demandez ce code à votre coach pour rejoindre son équipe</p>
                  </div>
                </>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {role === 'COACH' ? 'Suivant →' : (loading ? 'Création...' : 'Créer mon compte')}
              </button>
              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary-600 hover:underline font-medium">Se connecter</Link>
              </p>
            </form>
          )}

          {/* Étape 3 (Coach uniquement) : Nom de l'équipe */}
          {step === 'team' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep('info')} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
                <h2 className="text-xl font-bold text-gray-900">Votre équipe</h2>
              </div>
              <p className="text-sm text-gray-500">Ces informations permettront à vos joueuses de vous rejoindre.</p>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="label">Nom de l'équipe *</label>
                <input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ex: FC Exemple Féminines" required />
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={teamCategory} onChange={e => setTeamCategory(e.target.value)}>
                  <option value="">Choisir...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm text-primary-700">
                <p className="font-semibold mb-1">🔑 Un code d'invitation sera généré</p>
                <p>Partagez-le à vos joueuses pour qu'elles rejoignent votre équipe.</p>
              </div>
              <button onClick={handleSubmit} disabled={loading || !teamName} className="btn-primary w-full disabled:opacity-50">
                {loading ? 'Création...' : 'Créer mon compte et mon équipe'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
