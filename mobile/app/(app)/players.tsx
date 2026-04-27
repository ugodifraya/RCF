import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PlayersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-gray-900">Joueuses</Text>
      </View>
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-5xl">👥</Text>
        <Text className="text-gray-400 text-base">Migration en cours...</Text>
      </View>
    </SafeAreaView>
  );
}
