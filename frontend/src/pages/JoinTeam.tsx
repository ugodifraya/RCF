import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function JoinTeam() {
  const { code } = useParams<{ code: string }>();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [teamInfo, setTeamInfo] = useState<{ name: string; category?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code) return;
    api.get(`/teams/info/${code}`)
      .then(r => setTeamInfo(r.data))
      .catch(() => setError('Code invalide ou équipe introuvable.'))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!user) {
      // Not logged in → redirect to register with code prefilled
      navigate(`/register?code=${code}`);
      return;
    }
    setJoining(true);
    setError('');
    try {
      const r = await api.post('/teams/join', { code });
      setUser(u => u ? { ...u, teamId: r.data.user.teamId } : u);
      setDone(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Erreur lors de la jonction.');
    } finally { setJoining(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-primary-700">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary-700 font-bold text-2xl mx-auto mb-3 shadow-lg">R</div>
          <h1 className="text-2xl font-bold text-white">RCF Team Manager</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-5">
          {done ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto">✅</div>
              <h2 className="text-xl font-bold text-gray-900">Tu as rejoint l'équipe !</h2>
              <p className="text-gray-500 text-sm">Tu fais maintenant partie de <strong>{teamInfo?.name}</strong>.</p>
              <button onClick={() => navigate('/')} className="btn-primary w-full">Aller au tableau de bord</button>
            </>
          ) : error && !teamInfo ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mx-auto">❌</div>
              <h2 className="text-xl font-bold text-gray-900">Lien invalide</h2>
              <p className="text-gray-500 text-sm">{error}</p>
              <Link to="/" className="btn-secondary w-full block">Retour à l'accueil</Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-3xl mx-auto">⚽</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invitation d'équipe</h2>
                <p className="text-gray-500 text-sm mt-1">Tu as été invitée à rejoindre :</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-bold text-gray-900 text-lg">{teamInfo?.name}</p>
                {teamInfo?.category && <p className="text-sm text-gray-500 mt-0.5">{teamInfo.category}</p>}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {user ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Connecté en tant que <strong>{user.firstName} {user.lastName}</strong></p>
                  <button onClick={handleJoin} disabled={joining} className="btn-primary w-full">
                    {joining ? 'Rejoindre...' : 'Rejoindre l\'équipe'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">Connecte-toi ou crée un compte pour rejoindre.</p>
                  <button onClick={() => navigate(`/register?code=${code}`)} className="btn-primary w-full">
                    Créer un compte
                  </button>
                  <button onClick={() => navigate(`/login?redirect=/join/${code}`)} className="btn-secondary w-full">
                    Se connecter
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
