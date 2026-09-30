import { useContext } from 'react';
import { AuthContext, type AuthContextType } from '@/core/context/AuthContext';

/**
 * Custom React hook to access authentication state, user profile, role checks, and session methods.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
