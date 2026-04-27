import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import PickerModal from '../../src/components/PickerModal';

type Step = 'role' | 'info' | 'team';

const POSITIONS = ['Gardienne', 'Défenseure centrale', 'Latérale droite', 'Latérale gauche', 'Milieu défensif', 'Milieu central', 'Ailière', 'Attaquante'];
const CATEGORIES = ['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','Seniors','Vétéranes'];

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const { code: prefillCode } = useLocalSearchParams<{ code?: string }>();

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<'PLAYER' | 'COACH'>('PLAYER');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', position: '', birthDate: '' });
  const [teamName, setTeamName] = useState('');
  const [teamCategory, setTeamCategory] = useState('');
  const [teamCode, setTeamCode] = useState(prefillCode || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const set = (field: string) => (value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleInfoNext = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError('Merci de remplir tous les champs obligatoires.');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setError('');
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
        teamName:     role === 'COACH' ? teamName    : undefined,
        teamCategory: role === 'COACH' ? teamCategory : undefined,
        teamCode:     role === 'PLAYER' && teamCode ? teamCode : undefined,
      });
      router.replace('/(app)');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Erreur lors de l'inscription");
      if (role === 'COACH') setStep('team');
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
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-white rounded-2xl items-center justify-center mb-3 shadow-lg">
              <Text className="text-primary-700 font-bold text-2xl">R</Text>
            </View>
            <Text className="text-2xl font-bold text-white">RCF Team Manager</Text>
          </View>

          <View className="bg-white rounded-2xl shadow-xl p-8">

            {/* ── Étape 1 : Rôle ── */}
            {step === 'role' && (
              <View>
                <Text className="text-xl font-bold text-gray-900 text-center mb-1">Bienvenue !</Text>
                <Text className="text-gray-500 text-sm text-center mb-6">Vous êtes :</Text>
                <View className="flex-row gap-3 mb-6">
                  <TouchableOpacity
                    className="flex-1 items-center gap-2 p-5 rounded-xl border-2 border-gray-200"
                    onPress={() => { setRole('PLAYER'); setStep('info'); }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-4xl">⚽</Text>
                    <Text className="font-semibold text-gray-800">Joueuse</Text>
                    <Text className="text-xs text-gray-500 text-center">Stats, présences et suivi santé</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center gap-2 p-5 rounded-xl border-2 border-gray-200"
                    onPress={() => { setRole('COACH'); setStep('info'); }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-4xl">🏟️</Text>
                    <Text className="font-semibold text-gray-800">Coach</Text>
                    <Text className="text-xs text-gray-500 text-center">Gestion équipe, calendrier et santé</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-center text-sm text-gray-500">
                  Déjà un compte ?{' '}
                  <Link href="/(auth)/login" className="text-primary-600 font-medium">Se connecter</Link>
                </Text>
              </View>
            )}

            {/* ── Étape 2 : Infos personnelles ── */}
            {step === 'info' && (
              <View>
                <View className="flex-row items-center gap-3 mb-5">
                  <TouchableOpacity onPress={() => setStep('role')}>
                    <Text className="text-gray-400 text-xl">←</Text>
                  </TouchableOpacity>
                  <Text className="text-xl font-bold text-gray-900">
                    {role === 'COACH' ? 'Votre profil coach' : 'Créer un compte joueuse'}
                  </Text>
                </View>

                {error ? (
                  <View className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg mb-4">
                    <Text className="text-red-700 text-sm">{error}</Text>
                  </View>
                ) : null}

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-700 mb-1">Prénom *</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                      value={form.firstName}
                      onChangeText={set('firstName')}
                      placeholder="Emma"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-700 mb-1">Nom *</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                      value={form.lastName}
                      onChangeText={set('lastName')}
                      placeholder="Dupont"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Email *</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                    value={form.email}
                    onChangeText={set('email')}
                    placeholder="vous@exemple.fr"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Mot de passe *</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                    value={form.password}
                    onChangeText={set('password')}
                    placeholder="Minimum 6 caractères"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Date de naissance</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                    value={form.birthDate}
                    onChangeText={set('birthDate')}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                {role === 'PLAYER' && (
                  <>
                    <View className="mb-4">
                      <Text className="text-sm font-medium text-gray-700 mb-1">Poste</Text>
                      <TouchableOpacity
                        className="border border-gray-300 rounded-lg px-3 py-3 flex-row justify-between items-center"
                        onPress={() => setShowPositionPicker(true)}
                      >
                        <Text className={form.position ? 'text-gray-900 text-base' : 'text-gray-400 text-base'}>
                          {form.position || 'Choisir...'}
                        </Text>
                        <Text className="text-gray-400">▼</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="mb-4">
                      <Text className="text-sm font-medium text-gray-700 mb-1">
                        Code équipe <Text className="text-gray-400 font-normal">(optionnel)</Text>
                      </Text>
                      <TextInput
                        className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base tracking-widest"
                        value={teamCode}
                        onChangeText={v => setTeamCode(v.toUpperCase())}
                        placeholder="Ex: RCF3X7"
                        placeholderTextColor="#9ca3af"
                        maxLength={8}
                        autoCapitalize="characters"
                      />
                      <Text className="text-xs text-gray-400 mt-1">Demandez ce code à votre coach</Text>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  className={`bg-primary-600 rounded-lg py-3 items-center mt-2${loading ? ' opacity-70' : ''}`}
                  onPress={handleInfoNext}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-base">
                    {role === 'COACH' ? 'Suivant →' : loading ? 'Création...' : 'Créer mon compte'}
                  </Text>
                </TouchableOpacity>

                <Text className="text-center text-sm text-gray-500 mt-4">
                  Déjà un compte ?{' '}
                  <Link href="/(auth)/login" className="text-primary-600 font-medium">Se connecter</Link>
                </Text>

                <PickerModal
                  visible={showPositionPicker}
                  title="Poste"
                  options={POSITIONS}
                  selected={form.position}
                  onSelect={v => setForm(f => ({ ...f, position: v }))}
                  onClose={() => setShowPositionPicker(false)}
                />
              </View>
            )}

            {/* ── Étape 3 (Coach) : Équipe ── */}
            {step === 'team' && (
              <View>
                <View className="flex-row items-center gap-3 mb-5">
                  <TouchableOpacity onPress={() => setStep('info')}>
                    <Text className="text-gray-400 text-xl">←</Text>
                  </TouchableOpacity>
                  <Text className="text-xl font-bold text-gray-900">Votre équipe</Text>
                </View>

                <Text className="text-sm text-gray-500 mb-4">
                  Ces informations permettront à vos joueuses de vous rejoindre.
                </Text>

                {error ? (
                  <View className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg mb-4">
                    <Text className="text-red-700 text-sm">{error}</Text>
                  </View>
                ) : null}

                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Nom de l'équipe *</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-3 text-gray-900 text-base"
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Ex: FC Exemple Féminines"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View className="mb-5">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Catégorie</Text>
                  <TouchableOpacity
                    className="border border-gray-300 rounded-lg px-3 py-3 flex-row justify-between items-center"
                    onPress={() => setShowCategoryPicker(true)}
                  >
                    <Text className={teamCategory ? 'text-gray-900 text-base' : 'text-gray-400 text-base'}>
                      {teamCategory || 'Choisir...'}
                    </Text>
                    <Text className="text-gray-400">▼</Text>
                  </TouchableOpacity>
                </View>

                <View className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-5">
                  <Text className="font-semibold text-primary-700 mb-1">🔑 Un code d'invitation sera généré</Text>
                  <Text className="text-sm text-primary-600">Partagez-le à vos joueuses pour qu'elles rejoignent votre équipe.</Text>
                </View>

                <TouchableOpacity
                  className={`bg-primary-600 rounded-lg py-3 items-center${(loading || !teamName) ? ' opacity-50' : ''}`}
                  onPress={handleSubmit}
                  disabled={loading || !teamName}
                  activeOpacity={0.8}
                >
                  <Text className="text-white font-semibold text-base">
                    {loading ? 'Création...' : 'Créer mon compte et mon équipe'}
                  </Text>
                </TouchableOpacity>

                <PickerModal
                  visible={showCategoryPicker}
                  title="Catégorie"
                  options={CATEGORIES}
                  selected={teamCategory}
                  onSelect={setTeamCategory}
                  onClose={() => setShowCategoryPicker(false)}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
