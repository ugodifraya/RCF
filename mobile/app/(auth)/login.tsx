import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Email et mot de passe requis');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1e2a8e', '#2e3fe0']} className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-white rounded-2xl items-center justify-center mb-3 shadow-lg">
              <Text className="text-primary-700 font-bold text-2xl">R</Text>
            </View>
            <Text className="text-2xl font-bold text-white">RCF Team Manager</Text>
            <Text className="text-blue-200 mt-1">Gérez votre équipe simplement</Text>
          </View>

          {/* Carte */}
          <View className="bg-white rounded-2xl shadow-xl p-8">
            <Text className="text-xl font-bold text-gray-900 mb-6">Connexion</Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg mb-4">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.fr"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-1">Mot de passe</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              className={`bg-primary-600 rounded-lg py-3 items-center${loading ? ' opacity-70' : ''}`}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-base">
                {loading ? 'Connexion...' : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            <Text className="text-center text-sm text-gray-500 mt-6">
              Pas encore de compte ?{' '}
              <Link href="/(auth)/register" className="text-primary-600 font-medium">
                Créer un compte
              </Link>
            </Text>

            <View className="mt-6 pt-4 border-t border-gray-100">
              <Text className="text-xs font-medium text-gray-500 mb-1">Comptes de démo :</Text>
              <Text className="text-xs text-gray-400">Coach : coach@rcf.fr / coach123</Text>
              <Text className="text-xs text-gray-400">Joueuse : emma@rcf.fr / player123</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
