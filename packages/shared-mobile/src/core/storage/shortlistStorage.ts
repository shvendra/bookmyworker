import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'employer_shortlist';

export const shortlistStorage = {
  async getAll(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  },

  async isShortlisted(id: string): Promise<boolean> {
    const list = await this.getAll();
    return list.includes(id);
  },

  async toggle(id: string): Promise<boolean> {
    const list = await this.getAll();
    if (list.includes(id)) {
      await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((x) => x !== id)));
      return false;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify([...list, id]));
    return true;
  },

  async remove(id: string): Promise<void> {
    const list = await this.getAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((x) => x !== id)));
  },
};
