import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (name: string, email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('sl_session');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('sl_session', JSON.stringify(user));
    else localStorage.removeItem('sl_session');
  }, [user]);

  const login = async (email: string, password: string) => {
    const users: User[] = JSON.parse(localStorage.getItem('sl_users') || '[]');
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!found) throw new Error('ভুল ইমেইল বা পাসওয়ার্ড');
    setUser(found);
  };

  const register = async (name: string, email: string, password: string) => {
    const users: User[] = JSON.parse(localStorage.getItem('sl_users') || '[]');
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error('এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে');
    const newUser: User = { id: Date.now().toString(36), name, email: email.toLowerCase(), password, created_at: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem('sl_users', JSON.stringify(users));
    setUser(newUser);
  };

  const logout = () => setUser(null);

  const updateProfile = async (name: string, email: string) => {
    if (!user) return;
    const users: User[] = JSON.parse(localStorage.getItem('sl_users') || '[]');
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      if (users.some(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) throw new Error('এই ইমেইল অন্য কেউ ব্যবহার করছে');
      users[idx].name = name;
      users[idx].email = email.toLowerCase();
      localStorage.setItem('sl_users', JSON.stringify(users));
      setUser(users[idx]);
    }
  };

  return <AuthContext.Provider value={{ user, login, register, logout, updateProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
