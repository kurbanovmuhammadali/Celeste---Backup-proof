import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Tiny persistent flags (e.g. "intro already watched"). Failures are ignored: worst case the intro plays again. */
export async function getFlag(key: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' && localStorage.getItem(`astra.${key}`) === '1';
    return (await SecureStore.getItemAsync(`astra.${key}`)) === '1';
  } catch { return false; }
}
export async function setFlag(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') localStorage.setItem(`astra.${key}`, '1');
    else await SecureStore.setItemAsync(`astra.${key}`, '1');
  } catch {}
}
