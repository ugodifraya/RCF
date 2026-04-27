import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <View className="w-16 h-16 bg-primary-600 rounded-2xl items-center justify-center mb-4">
        <Text className="text-white font-bold text-2xl">R</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900 mb-1">
        Bonjour, {user?.firstName} !
      </Text>
      <Text className="text-gray-500 mb-8">Dashboard (à venir)</Text>

      <TouchableOpacity
        className="bg-red-50 border border-red-200 px-6 py-3 rounded-lg"
        onPress={logout}
        activeOpacity={0.8}
      >
        <Text className="text-red-600 font-medium">Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}
