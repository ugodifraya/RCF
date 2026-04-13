import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Step = 'role' | 'info';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'PLAYER' | 'COACH'>('PLAYER');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', position: '', number: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, role });
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? 'Création...' : 'Créer mon compte'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary-600 hover:underline font-medium">Se connecter</Link>
              </p>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
