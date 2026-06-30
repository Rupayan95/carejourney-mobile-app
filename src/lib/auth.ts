import * as SecureStore from 'expo-secure-store';
import { api } from './api';

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  user_type: string;
  department?: string;
  doctor_id?: string;
  organization_id?: string;
  permissions: string[];
}

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync('backend-token', access);
  await SecureStore.setItemAsync('refresh-token', refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('backend-token');
  await SecureStore.deleteItemAsync('refresh-token');
}

export async function getToken() {
  return SecureStore.getItemAsync('backend-token');
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await api.get('/users/me');
  return res.data.data;
}
