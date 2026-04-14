import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Event, Questionnaire, Team } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MyStats {
  attendance: { total: number; present: number; absent: number; rate: number };
  matchStats: { goals: number; assists: number; minutesPlayed: number; matchesPlayed: number };
  injuries: { status: string }[];
}

interface TeamStats {
  totalPlayers: number;
  totalEvents: number;
  totalMatches: number;
  matchResults: { wins: number; losses: number; draws: number; total: number };
  injuryStats: { status: string; _count: { status: number } }[];
}

export default function Dashboard() {
  const { user, isCoach, setUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  // Invite modal (coach)
  const [showInvite, setShowInvite] = useState(false);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Join team (player)
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.slice(0, 3)));
    api.get('/questionnaires').then(r => setQuestionnaires(r.data.filter((q: Questionnaire) => q.isActive).slice(0, 3)));
    if (!isCoach) api.get('/stats/my-stats').then(r => setMyStats(r.data)).catch(() => {});
    if (isCoach) api.get('/stats/team').then(r => setTeamStats(r.data)).catch(() => {});
  }, [isCoach]);

  const openInvite = async () => {
    setShowInvite(true);
    if (myTeam) return;
    setLoadingTeam(true);
    try {
      const r = await api.get('/teams/my');
      setMyTeam(r.data);
    } catch { } finally { setLoadingTeam(false); }
  };

  const inviteLink = myTeam ? `${window.location.origin}/join/${myTeam.inviteCode}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      const r = await api.post('/teams/regenerate-code');
      setMyTeam(t => t ? { ...t, inviteCode: r.data.inviteCode } : t);
    } catch { } finally { setRegenerating(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoining(true); setJoinError(''); setJoinSuccess('');
    try {
      const r = await api.post('/teams/join', { code: joinCode.trim().toUpperCase() });
      setUser(u => u ? { ...u, teamId: r.data.user.teamId } : u);
      setJoinSuccess(`Tu as rejoint "${r.data.team.name}" !`);
      setShowJoin(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setJoinError(e.response?.data?.error || 'Code invalide.');
    } finally { setJoining(false); }
  };

  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date());
  const pendingQuestionnaires = questionnaires.filter(q => {
    if (isCoach) return true;
    return (q.responses as { id: string }[]).length === 0;
  });
  const activeInjuries = myStats?.injuries.filter(i => i.status === 'ACTIVE').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</h1>
          <p className="text-gray-500 mt-1">
            {isCoach ? "Vue d'ensemble de votre équipe" : 'Votre espace personnel'}
          </p>
        </div>
        {isCoach && (
          <button onClick={openInvite} className="btn-primary flex items-center gap-2 text-sm">
            <span className="text-lg leading-none">+</span> Inviter des membres
          </button>
        )}
      </div>

      {/* Bannière jouese sans équipe */}
      {!isCoach && !user?.teamId && !joinSuccess && (
        <div className="card bg-primary-50 border-primary-200 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-primary-900">Rejoins ton équipe</p>
            <p className="text-sm text-primary-700 mt-0.5">Demande le code à ton coach et saisis-le ici.</p>
          </div>
          <button onClick={() => setShowJoin(true)} className="btn-primary text-sm shrink-0">Saisir le code</button>
        </div>
      )}

      {joinSuccess && (
        <div className="card bg-green-50 border-green-200">
          <p className="text-green-800 font-semibold">✅ {joinSuccess}</p>
        </div>
      )}

      {!isCoach && myStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Taux de présence" value={`${myStats.attendance.rate}%`} icon="✅" color="green" />
          <StatCard label="Buts" value={myStats.matchStats.goals} icon="⚽" color="blue" />
          <StatCard label="Passes décisives" value={myStats.matchStats.assists} icon="🎯" color="purple" />
          <StatCard label={activeInjuries > 0 ? 'Blessure active' : 'En forme'} value={activeInjuries > 0 ? '⚠️' : '💪'} icon="" color={activeInjuries > 0 ? 'red' : 'green'} />
        </div>
      )}

      {isCoach && teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Joueuses" value={teamStats.totalPlayers} icon="👥" color="blue" />
          <StatCard label="Victoires" value={teamStats.matchResults.wins} icon="🏆" color="green" />
          <StatCard label="Défaites" value={teamStats.matchResults.losses} icon="📉" color="red" />
          <StatCard label="Matchs joués" value={teamStats.matchResults.total} icon="⚽" color="purple" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Prochains événements</h2>
            <Link to="/events" className="text-sm text-primary-600 hover:underline">Voir tout</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Aucun événement à venir</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                    event.type === 'MATCH' ? 'bg-green-100' : event.type === 'TRAINING' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    {event.type === 'MATCH' ? '⚽' : event.type === 'TRAINING' ? '🏃' : '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{event.title}</p>
                    <p className="text-xs text-gray-500">{format(new Date(event.date), 'EEEE d MMMM à HH:mm', { locale: fr })}</p>
                  </div>
                  {!isCoach && event.attendances && event.attendances[0] && (
                    <AttendanceBadge status={event.attendances[0].status} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Questionnaires {isCoach ? '' : 'en attente'}</h2>
            <Link to="/questionnaires" className="text-sm text-primary-600 hover:underline">Voir tout</Link>
          </div>
          {pendingQuestionnaires.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              {isCoach ? 'Aucun questionnaire actif' : 'Tous les questionnaires sont complétés ✓'}
            </p>
          ) : (
            <div className="space-y-3">
              {pendingQuestionnaires.map(q => (
                <Link key={q.id} to={`/questionnaires/${q.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-lg">📋</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{q.title}</p>
                    <p className="text-xs text-gray-500">
                      {isCoach
                        ? `${q._count?.responses ?? 0} réponse(s) / ${q._count?.questions ?? 0} questions`
                        : `${q._count?.questions ?? 0} questions`
                      }
                    </p>
                  </div>
                  <span className="badge-yellow">À faire</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isCoach && (
        <div className="card bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>🩸</span> Suivi cycle menstruel
              </h2>
              <p className="text-sm text-gray-600 mt-1">Notez vos périodes et votre niveau de douleur</p>
            </div>
            <Link to="/health" className="btn-primary text-sm">Accéder</Link>
          </div>
        </div>
      )}

      {/* ── Modal invitation (coach) ── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Inviter des membres</h2>
              <button onClick={() => setShowInvite(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <p className="text-sm text-gray-500">Partagez le lien ou le code pour inviter vos joueuses.</p>
              {loadingTeam ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                </div>
              ) : myTeam ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Partager le lien</p>
                    <div className="flex gap-2">
                      <input readOnly value={inviteLink} className="input flex-1 text-sm font-mono bg-gray-50 text-gray-600" />
                      <button onClick={copyLink} className={`px-3 rounded-xl border-2 text-sm font-medium transition-colors shrink-0 ${copied ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {copied ? '✓' : '⎘'}
                      </button>
                    </div>
                    <button onClick={copyLink} className="btn-primary w-full mt-2 text-sm">
                      {copied ? '✓ Lien copié !' : 'Copier le lien d\'invitation'}
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Code d'invitation</p>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold font-mono tracking-widest text-primary-700">{myTeam.inviteCode}</p>
                      <p className="text-xs text-gray-400 mt-1">Les joueuses saisissent ce code à l'inscription</p>
                    </div>
                  </div>

                  <button onClick={regenerateCode} disabled={regenerating} className="w-full py-2 rounded-xl border-2 border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors disabled:opacity-50">
                    {regenerating ? 'Génération...' : '🔄 Générer un nouveau code'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-red-500 text-center py-4">Aucune équipe trouvée. Recréez votre compte coach.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal rejoindre équipe (joueuse) ── */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Rejoindre une équipe</h2>
              <button onClick={() => setShowJoin(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">Demande le code à ton coach et saisis-le ci-dessous.</p>
              <div>
                <label className="label">Code équipe</label>
                <input
                  className="input uppercase tracking-widest font-mono text-center text-xl"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="RCF3X7"
                  maxLength={8}
                  autoFocus
                />
              </div>
              {joinError && <p className="text-sm text-red-600">{joinError}</p>}
              <div className="flex gap-2">
                <button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="btn-primary flex-1 disabled:opacity-50">
                  {joining ? 'Rejoindre...' : 'Rejoindre'}
                </button>
                <button onClick={() => setShowJoin(false)} className="btn-secondary flex-1">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    red: 'bg-red-50 border-red-200',
  };
  return (
    <div className={`card ${colors[color] || ''} p-4`}>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">{icon && <span>{icon}</span>}{label}</p>
    </div>
  );
}

function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PRESENT: { label: 'Présente', className: 'badge-green' },
    ABSENT: { label: 'Absente', className: 'badge-red' },
    MAYBE: { label: 'Peut-être', className: 'badge-yellow' },
    PENDING: { label: 'En attente', className: 'badge-gray' },
  };
  const s = map[status] || map.PENDING;
  return <span className={s.className}>{s.label}</span>;
}
