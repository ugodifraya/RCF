import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary-700 font-bold text-2xl mx-auto mb-3 shadow-lg">R</div>
          <h1 className="text-2xl font-bold text-white">RCF Team Manager</h1>
          <p className="text-primary-200 mt-1">Gérez votre équipe simplement</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Connexion</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vous@exemple.fr" />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">Créer un compte</Link>
          </p>
          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-500">Comptes de démo :</p>
            <p>Coach : coach@rcf.fr / coach123</p>
            <p>Joueuse : emma@rcf.fr / player123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
