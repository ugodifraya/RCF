import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator, Share,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';
import { Event, Questionnaire, Team } from '../../src/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MyStats {
  attendance: { total: number; present: number; absent: number; rate: number };
  matchStats: { goals: number; assists: number; minutesPlayed: number; matchesPlayed: number };
  injuries: { status: string }[];
}

interface TeamStats {
  totalPlayers: number;
  matchResults: { wins: number; losses: number; draws: number; total: number };
}

const ATTENDANCE_LABELS: Record<string, { label: string; color: string }> = {
  PRESENT: { label: 'Présente', color: 'text-green-700 bg-green-50' },
  ABSENT:  { label: 'Absente',  color: 'text-red-700 bg-red-50'   },
  MAYBE:   { label: 'Peut-être', color: 'text-yellow-700 bg-yellow-50' },
  PENDING: { label: 'En attente', color: 'text-gray-600 bg-gray-100' },
};

export default function Dashboard() {
  const { user, isCoach, setUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  // Invite (coach)
  const [showInvite, setShowInvite] = useState(false);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Join (player)
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.slice(0, 3)));
    api.get('/questionnaires').then(r =>
      setQuestionnaires(r.data.filter((q: Questionnaire) => q.isActive).slice(0, 3))
    );
    if (!isCoach) api.get('/stats/my-stats').then(r => setMyStats(r.data)).catch(() => {});
    if (isCoach)  api.get('/stats/team').then(r => setTeamStats(r.data)).catch(() => {});
  }, [isCoach]);

  const openInvite = async () => {
    setShowInvite(true);
    if (myTeam) return;
    setLoadingTeam(true);
    try {
      const r = await api.get('/teams/my');
      setMyTeam(r.data);
    } catch {} finally { setLoadingTeam(false); }
  };

  const handleShare = async () => {
    if (!myTeam) return;
    await Share.share({
      message: `Rejoins mon équipe sur RCF Team Manager !\nCode d'invitation : ${myTeam.inviteCode}`,
    });
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      const r = await api.post('/teams/regenerate-code');
      setMyTeam(t => t ? { ...t, inviteCode: r.data.inviteCode } : t);
    } catch {} finally { setRegenerating(false); }
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
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>

        {/* Header */}
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Bonjour, {user?.firstName} 👋</Text>
            <Text className="text-gray-500 mt-0.5">
              {isCoach ? "Vue d'ensemble de votre équipe" : 'Votre espace personnel'}
            </Text>
          </View>
          {isCoach && (
            <TouchableOpacity
              className="bg-primary-600 rounded-xl px-4 py-2 flex-row items-center gap-1"
              onPress={openInvite}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-sm">+ Inviter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bannière rejoindre équipe (jouese sans équipe) */}
        {!isCoach && !user?.teamId && !joinSuccess && (
          <View className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex-row justify-between items-center">
            <View className="flex-1 mr-3">
              <Text className="font-semibold text-primary-900">Rejoins ton équipe</Text>
              <Text className="text-sm text-primary-700 mt-0.5">Demande le code à ton coach et saisis-le ici.</Text>
            </View>
            <TouchableOpacity
              className="bg-primary-600 rounded-lg px-4 py-2"
              onPress={() => setShowJoin(true)}
            >
              <Text className="text-white font-semibold text-sm">Saisir le code</Text>
            </TouchableOpacity>
          </View>
        )}

        {joinSuccess ? (
          <View className="bg-green-50 border border-green-200 rounded-xl p-4">
            <Text className="text-green-800 font-semibold">✅ {joinSuccess}</Text>
          </View>
        ) : null}

        {/* Stats joueuse */}
        {!isCoach && myStats && (
          <View className="flex-row flex-wrap gap-3">
            <StatCard label="Taux de présence" value={`${myStats.attendance.rate}%`} icon="✅" color="green" />
            <StatCard label="Buts" value={myStats.matchStats.goals} icon="⚽" color="blue" />
            <StatCard label="Passes déc." value={myStats.matchStats.assists} icon="🎯" color="purple" />
            <StatCard
              label={activeInjuries > 0 ? 'Blessure active' : 'En forme'}
              value={activeInjuries > 0 ? '⚠️' : '💪'}
              icon=""
              color={activeInjuries > 0 ? 'red' : 'green'}
            />
          </View>
        )}

        {/* Stats coach */}
        {isCoach && teamStats && (
          <View className="flex-row flex-wrap gap-3">
            <StatCard label="Joueuses" value={teamStats.totalPlayers} icon="👥" color="blue" />
            <StatCard label="Victoires" value={teamStats.matchResults.wins} icon="🏆" color="green" />
            <StatCard label="Défaites" value={teamStats.matchResults.losses} icon="📉" color="red" />
            <StatCard label="Matchs joués" value={teamStats.matchResults.total} icon="⚽" color="purple" />
          </View>
        )}

        {/* Prochains événements */}
        <View className="bg-white rounded-xl p-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-semibold text-gray-900">Prochains événements</Text>
            <Link href="/calendar" asChild>
              <TouchableOpacity><Text className="text-sm text-primary-600">Voir tout</Text></TouchableOpacity>
            </Link>
          </View>
          {upcomingEvents.length === 0 ? (
            <Text className="text-gray-400 text-sm text-center py-3">Aucun événement à venir</Text>
          ) : (
            <View className="gap-2">
              {upcomingEvents.map(event => {
                const bg = event.type === 'MATCH' ? 'bg-green-100' : event.type === 'TRAINING' ? 'bg-blue-100' : 'bg-purple-100';
                const icon = event.type === 'MATCH' ? '⚽' : event.type === 'TRAINING' ? '🏃' : '📌';
                const att = event.attendances?.[0];
                const badge = att ? ATTENDANCE_LABELS[att.status] : null;
                return (
                  <View key={event.id} className="flex-row items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <View className={`w-10 h-10 rounded-lg ${bg} items-center justify-center`}>
                      <Text>{icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-medium text-gray-900 text-sm" numberOfLines={1}>{event.title}</Text>
                      <Text className="text-xs text-gray-500">
                        {format(new Date(event.date), 'dd MMM · HH:mm', { locale: fr })}
                      </Text>
                    </View>
                    {!isCoach && badge && (
                      <View className={`px-2 py-0.5 rounded-full ${badge.color}`}>
                        <Text className={`text-xs font-medium ${badge.color.split(' ')[0]}`}>{badge.label}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Questionnaires */}
        <View className="bg-white rounded-xl p-4 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-semibold text-gray-900">
              Questionnaires{isCoach ? '' : ' en attente'}
            </Text>
            <Link href="/questionnaires" asChild>
              <TouchableOpacity><Text className="text-sm text-primary-600">Voir tout</Text></TouchableOpacity>
            </Link>
          </View>
          {pendingQuestionnaires.length === 0 ? (
            <Text className="text-gray-400 text-sm text-center py-3">
              {isCoach ? 'Aucun questionnaire actif' : 'Tous les questionnaires sont complétés ✓'}
            </Text>
          ) : (
            <View className="gap-2">
              {pendingQuestionnaires.map(q => (
                <TouchableOpacity key={q.id} className="flex-row items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <View className="w-10 h-10 rounded-lg bg-orange-100 items-center justify-center">
                    <Text>📋</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-gray-900 text-sm" numberOfLines={1}>{q.title}</Text>
                    <Text className="text-xs text-gray-500">
                      {isCoach
                        ? `${q._count?.responses ?? 0} réponse(s) · ${q._count?.questions ?? 0} questions`
                        : `${q._count?.questions ?? 0} questions`}
                    </Text>
                  </View>
                  <View className="px-2 py-0.5 rounded-full bg-yellow-100">
                    <Text className="text-xs font-medium text-yellow-700">À faire</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Suivi cycle (joueuse) */}
        {!isCoach && (
          <View className="bg-pink-50 border border-pink-200 rounded-xl p-4 flex-row justify-between items-center">
            <View className="flex-1 mr-3">
              <Text className="font-semibold text-gray-900">🩸 Suivi cycle menstruel</Text>
              <Text className="text-sm text-gray-600 mt-0.5">Notez vos périodes et votre niveau de douleur</Text>
            </View>
            <Link href="/health" asChild>
              <TouchableOpacity className="bg-primary-600 rounded-lg px-4 py-2">
                <Text className="text-white font-semibold text-sm">Accéder</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}

        <View className="h-4" />
      </ScrollView>

      {/* ── Modal invitation (coach) ── */}
      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <TouchableOpacity
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => setShowInvite(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View className="bg-white rounded-t-3xl">
              <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-100">
                <Text className="text-lg font-bold text-gray-900">Inviter des membres</Text>
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  onPress={() => setShowInvite(false)}
                >
                  <Text className="text-gray-500">✕</Text>
                </TouchableOpacity>
              </View>
              <View className="px-6 py-5 gap-5 pb-10">
                <Text className="text-sm text-gray-500">Partagez le code pour inviter vos joueuses.</Text>
                {loadingTeam ? (
                  <ActivityIndicator size="large" color="#3b52f5" className="py-6" />
                ) : myTeam ? (
                  <>
                    <View className="bg-gray-50 rounded-xl p-5 items-center">
                      <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Code d'invitation
                      </Text>
                      <Text className="text-4xl font-bold tracking-widest text-primary-700">
                        {myTeam.inviteCode}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-2">
                        Les joueuses saisissent ce code à l'inscription
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="bg-primary-600 rounded-xl py-3 items-center"
                      onPress={handleShare}
                      activeOpacity={0.8}
                    >
                      <Text className="text-white font-semibold">Partager l'invitation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`border-2 border-gray-200 rounded-xl py-3 items-center${regenerating ? ' opacity-50' : ''}`}
                      onPress={regenerateCode}
                      disabled={regenerating}
                    >
                      <Text className="text-gray-600 text-sm">
                        {regenerating ? 'Génération...' : '🔄 Générer un nouveau code'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text className="text-sm text-red-500 text-center py-4">
                    Aucune équipe trouvée.
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal rejoindre équipe (joueuse) ── */}
      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <TouchableOpacity
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => setShowJoin(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View className="bg-white rounded-t-3xl px-6 pt-4 pb-10">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-900">Rejoindre une équipe</Text>
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  onPress={() => setShowJoin(false)}
                >
                  <Text className="text-gray-500">✕</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-sm text-gray-500 mb-4">Demande le code à ton coach et saisis-le ci-dessous.</Text>
              <Text className="text-sm font-medium text-gray-700 mb-1">Code équipe</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-xl text-center tracking-widest mb-2"
                value={joinCode}
                onChangeText={v => setJoinCode(v.toUpperCase())}
                placeholder="RCF3X7"
                placeholderTextColor="#9ca3af"
                maxLength={8}
                autoCapitalize="characters"
                autoFocus
              />
              {joinError ? <Text className="text-sm text-red-600 mb-2">{joinError}</Text> : null}
              <View className="flex-row gap-3 mt-2">
                <TouchableOpacity
                  className={`flex-1 bg-primary-600 rounded-lg py-3 items-center${(joining || !joinCode.trim()) ? ' opacity-50' : ''}`}
                  onPress={handleJoin}
                  disabled={joining || !joinCode.trim()}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold">{joining ? 'Rejoindre...' : 'Rejoindre'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 border-2 border-gray-200 rounded-lg py-3 items-center"
                  onPress={() => setShowJoin(false)}
                >
                  <Text className="text-gray-700 font-semibold">Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-50 border-green-200',
    blue:   'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    red:    'bg-red-50 border-red-200',
  };
  return (
    <View className={`flex-1 min-w-[46%] border rounded-xl p-4 ${colors[color] ?? ''}`}>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      <Text className="text-xs text-gray-500 mt-1">
        {icon ? `${icon} ` : ''}{label}
      </Text>
    </View>
  );
}
