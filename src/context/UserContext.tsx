import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchProfile, getToken, UserProfile } from '../lib/auth';

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true, reload: async () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const token = await getToken();
      if (token) setUser(await fetchProfile());
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <UserContext.Provider value={{ user, loading, reload: load }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

// Role helpers
export const isDoctor = (role?: string) => ['physician', 'therapist'].includes(role ?? '');
export const isNurse = (role?: string) => role === 'nurse';
export const isReceptionist = (role?: string) => role === 'receptionist';
export const isLabTech = (role?: string) => role === 'lab_technician';
export const isPharmacist = (role?: string) => role === 'pharmacist';
export const isBilling = (role?: string) => role === 'billing_officer';
export const isAdmin = (role?: string) => role === 'admin';
export const isPatient = (role?: string) => role === 'patient';
