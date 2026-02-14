"use client";

import { logger } from '@/lib/logger';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface User {
  email: string;
  displayName: string;
  role: 'teacher' | 'manager';
  localId: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  logout: () => void;
  updateUser: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  logout: () => {},
  updateUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication status - only run once on mount
    try {
      logger.info('Initializing auth context...');
      
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        logger.success('Auth restored from localStorage', { email: parsedUser.email });
      } else {
        logger.info('No stored auth found');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error initializing auth', { error: message });
      // Clear corrupted data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array - only run once

  const logout = () => {
    try {
      logger.info('Logging out user', { email: user?.email });
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      
      toast.success('Đăng xuất thành công!', { icon: '👋' });
      logger.success('User logged out successfully');
      
      router.push('/login');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error during logout', { error: message });
      toast.error('Có lỗi khi đăng xuất');
    }
  };

  const updateUser = (newUser: User, newToken: string) => {
    try {
      logger.info('Updating user in auth context', { email: newUser.email });
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      setToken(newToken);
      
      logger.success('Auth context updated successfully', { email: newUser.email });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error updating user', { error: message });
      toast.error('Có lỗi khi cập nhật thông tin');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
