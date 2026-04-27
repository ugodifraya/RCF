import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';

export default function JoinTeam() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, setUser } = useAuth();
  const router = useRouter();

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
      router.push(`/(auth)/register?code=${code}`);
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
    } finally {
      setJoining(false);
    }
  };

  return (
    <LinearGradient colors={['#1e2a8e', '#2e3fe0']} className="flex-1">
      <SafeAreaView className="flex-1 items-center justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-white rounded-2xl items-center justify-center mb-3 shadow-lg">
            <Text className="text-primary-700 font-bold text-2xl">R</Text>
          </View>
          <Text className="text-2xl font-bold text-white">RCF Team Manager</Text>
        </View>

        <View className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm items-center">
          {loading ? (
            <ActivityIndicator size="large" color="#3b52f5" className="py-8" />
          ) : done ? (
            // ── Succès ──
            <View className="items-center gap-4 w-full">
              <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center">
                <Text className="text-3xl">✅</Text>
              </View>
              <Text className="text-xl font-bold text-gray-900">Tu as rejoint l'équipe !</Text>
              <Text className="text-gray-500 text-sm text-center">
                Tu fais maintenant partie de <Text className="font-bold">{teamInfo?.name}</Text>.
              </Text>
              <TouchableOpacity
                className="bg-primary-600 rounded-lg py-3 items-center w-full mt-2"
                onPress={() => router.replace('/(app)')}
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold">Aller au tableau de bord</Text>
              </TouchableOpacity>
            </View>
          ) : error && !teamInfo ? (
            // ── Lien invalide ──
            <View className="items-center gap-4 w-full">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center">
                <Text className="text-3xl">❌</Text>
              </View>
              <Text className="text-xl font-bold text-gray-900">Lien invalide</Text>
              <Text className="text-gray-500 text-sm text-center">{error}</Text>
              <Link href="/(app)" asChild>
                <TouchableOpacity className="border-2 border-gray-200 rounded-lg py-3 items-center w-full mt-2">
                  <Text className="text-gray-700 font-semibold">Retour à l'accueil</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            // ── Invitation ──
            <View className="items-center gap-4 w-full">
              <View className="w-16 h-16 bg-primary-100 rounded-full items-center justify-center">
                <Text className="text-3xl">⚽</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-bold text-gray-900">Invitation d'équipe</Text>
                <Text className="text-gray-500 text-sm mt-1">Tu as été invitée à rejoindre :</Text>
              </View>
              <View className="bg-gray-50 rounded-xl p-4 w-full items-center">
                <Text className="font-bold text-gray-900 text-lg">{teamInfo?.name}</Text>
                {teamInfo?.category && (
                  <Text className="text-sm text-gray-500 mt-0.5">{teamInfo.category}</Text>
                )}
              </View>

              {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

              {user ? (
                <View className="w-full gap-3">
                  <Text className="text-xs text-gray-400 text-center">
                    Connectée en tant que <Text className="font-bold">{user.firstName} {user.lastName}</Text>
                  </Text>
                  <TouchableOpacity
                    className={`bg-primary-600 rounded-lg py-3 items-center w-full${joining ? ' opacity-70' : ''}`}
                    onPress={handleJoin}
                    disabled={joining}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-semibold">
                      {joining ? 'Rejoindre...' : "Rejoindre l'équipe"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="w-full gap-3">
                  <Text className="text-sm text-gray-500 text-center">
                    Connecte-toi ou crée un compte pour rejoindre.
                  </Text>
                  <TouchableOpacity
                    className="bg-primary-600 rounded-lg py-3 items-center w-full"
                    onPress={() => router.push(`/(auth)/register?code=${code}`)}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-semibold">Créer un compte</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="border-2 border-primary-600 rounded-lg py-3 items-center w-full"
                    onPress={() => router.push('/(auth)/login')}
                    activeOpacity={0.8}
                  >
                    <Text className="text-primary-600 font-semibold">Se connecter</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
