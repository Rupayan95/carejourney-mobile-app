import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Backend base URL. Set EXPO_PUBLIC_API_URL in `.env.local` to override. The
// fallback is the shared dev backend exposed via the public domain proxy.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://devcj.prd-wrk.tech/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('backend-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
