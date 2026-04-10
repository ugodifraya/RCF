import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Event, Questionnaire } from '../types';
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
  const { user, isCoach } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.slice(0, 3)));
    api.get('/questionnaires').then(r => setQuestionnaires(r.data.filter((q: Questionnaire) => q.isActive).slice(0, 3)));
    if (!isCoach) api.get('/stats/my-stats').then(r => setMyStats(r.data));
    if (isCoach) api.get('/stats/team').then(r => setTeamStats(r.data));
  }, [isCoach]);

  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date());
  const pendingQuestionnaires = questionnaires.filter(q => {
    if (isCoach) return true;
    return (q.responses as { id: string }[]).length === 0;
  });

  const activeInjuries = myStats?.injuries.filter(i => i.status === 'ACTIVE').length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</h1>
        <p className="text-gray-500 mt-1">
          {isCoach ? "Vue d'ensemble de votre équipe" : 'Votre espace personnel'}
        </p>
      </div>

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
      <p className="text-2xl font-bold text-gray-900">{typeof value === 'string' && !value.includes('%') ? value : value}</p>
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
