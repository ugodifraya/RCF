import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function PickerModal({ visible, title, options, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/50 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1}>
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: 420 }}>
            <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-100">
              <Text className="font-bold text-gray-900 text-lg">{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text className="text-primary-600 font-semibold">Fermer</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  className={`px-6 py-4 border-b border-gray-50 flex-row justify-between items-center${selected === opt ? ' bg-primary-50' : ''}`}
                  onPress={() => { onSelect(opt); onClose(); }}
                >
                  <Text className={selected === opt ? 'text-primary-700 font-semibold' : 'text-gray-700'}>
                    {opt}
                  </Text>
                  {selected === opt && <Text className="text-primary-600">✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
