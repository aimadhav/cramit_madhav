import AsyncStorage from '@react-native-async-storage/async-storage';

// A simple in-memory storage for environments where AsyncStorage is not available (mainly for Server-Side Rendering)
// [honestly might remove this later]
const dummyStorage = {
  getItem: async (key: string) => null,
  setItem: async (key: string, value: string) => {},
  removeItem: async (key: string) => {},
  clear: async () => {},
};


export const getSafeStorage = () => {
  if (typeof window === 'undefined') {
    return dummyStorage;
  }
  return AsyncStorage;
};
