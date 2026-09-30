import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

export type RoleIdentifier =
  | 'super_admin'
  | 'full_admin'
  | 'billing_admin'
  | 'chapter_admin'
  | 'group_admin'
  | 'member'
  | 'guest';

export interface UserRoleAssignment {
  roleId: string;
  scopeType: 'chamber' | 'chapter' | 'group';
  scopeId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  phone?: string | null;
  name?: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  highestRole: RoleIdentifier;
  pointsBalance: number;
}

export interface ChamberInfo {
  id: string;
  name: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  roles: UserRoleAssignment[];
  chamber: ChamberInfo | null;
  highestRole: RoleIdentifier | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (
    token: string,
    user: UserProfile,
    roles?: UserRoleAssignment[],
    chamber?: ChamberInfo | null
  ) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasRole: (roles: RoleIdentifier[]) => boolean;
  hasScope: (scopeType: 'chamber' | 'chapter' | 'group', scopeId: string) => boolean;
  showIdleWarning: boolean;
  idleCountdownSeconds: number;
  extendSession: () => Promise<void>;
  showSessionExpired: boolean;
  dismissSessionExpired: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_WARNING_MS = 25 * 60 * 1000; // 25 minutes of continuous inactivity
const TOTAL_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes total (5-minute countdown)

/**
 * Checks whether user has permission for a specific scope
 * Chamber full admin has global chamber access across all chapters and groups.
 */
export function checkScopeAccess(
  roles: UserRoleAssignment[],
  highestRole: RoleIdentifier | null,
  requiredScopeType: 'chamber' | 'chapter' | 'group',
  targetScopeId: string
): boolean {
  if (highestRole === 'super_admin') return true;
  if (
    highestRole === 'full_admin' ||
    roles.some((r) => r.roleId === 'full_admin' && r.scopeType === 'chamber')
  ) {
    return true;
  }
  return roles.some(
    (r) => r.scopeType === requiredScopeType && r.scopeId === targetScopeId
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        return {
          id: u.id,
          email: u.email,
          phone: u.phone,
          name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          avatarUrl: u.avatarUrl || null,
          highestRole: (u.highestRole as RoleIdentifier) || 'member',
          pointsBalance: u.pointsBalance ?? 0,
        };
      }
    } catch {}
    return null;
  });

  const [roles, setRoles] = useState<UserRoleAssignment[]>(() => {
    try {
      const stored = localStorage.getItem('auth_roles');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [chamber, setChamber] = useState<ChamberInfo | null>(() => {
    try {
      const stored = localStorage.getItem('auth_chamber');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);
  const [idleCountdownSeconds, setIdleCountdownSeconds] = useState<number>(300);
  const [showSessionExpired, setShowSessionExpired] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<any>(null);

  // Helper to persist auth data
  const persistAuth = (
    newToken: string | null,
    newUser: UserProfile | null,
    newRoles: UserRoleAssignment[] = [],
    newChamber: ChamberInfo | null = null
  ) => {
    if (newToken && newUser) {
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      localStorage.setItem('auth_roles', JSON.stringify(newRoles));
      if (newChamber) {
        localStorage.setItem('auth_chamber', JSON.stringify(newChamber));
      } else {
        localStorage.removeItem('auth_chamber');
      }
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_roles');
      localStorage.removeItem('auth_chamber');
    }
    setToken(newToken);
    setUser(newUser);
    setRoles(newRoles);
    setChamber(newChamber);
  };

  // 1. Session Refresh / Introspection via GET /api/v1/auth/me
  const refreshSession = useCallback(async () => {
    const currentToken = localStorage.getItem('auth_token');
    if (!currentToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalidated in KV
          persistAuth(null, null, [], null);
          setShowSessionExpired(true);
        }
        return;
      }

      const data = await res.json();
      if (data.success && data.data?.user) {
        const u = data.data.user;
        const mappedUser: UserProfile = {
          id: u.id,
          email: u.email,
          phone: u.phone,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          avatarUrl: u.avatarUrl || null,
          highestRole: (u.highestRole as RoleIdentifier) || 'member',
          pointsBalance: u.pointsBalance ?? 0,
        };
        const mappedRoles: UserRoleAssignment[] = data.data.roles || [];
        const mappedChamber: ChamberInfo | null = data.data.chamber || null;

        persistAuth(currentToken, mappedUser, mappedRoles, mappedChamber);
        lastActivityRef.current = Date.now();
      }
    } catch (err) {
      console.warn('[AUTH_REFRESH_WARNING]', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Hydrate on mount & listen for global 401 expired events
  useEffect(() => {
    refreshSession();

    const handleExpiredEvent = () => {
      persistAuth(null, null, [], null);
      setShowSessionExpired(true);
    };
    window.addEventListener('auth:session_expired', handleExpiredEvent);
    return () => {
      window.removeEventListener('auth:session_expired', handleExpiredEvent);
    };
  }, [refreshSession]);

  // 2. Login Action
  const login = (
    newToken: string,
    newUser: UserProfile,
    newRoles: UserRoleAssignment[] = [],
    newChamber: ChamberInfo | null = null
  ) => {
    persistAuth(newToken, newUser, newRoles, newChamber);
    lastActivityRef.current = Date.now();
    setShowIdleWarning(false);
    setShowSessionExpired(false);
  };

  // 3. Logout Action (Purges Cloudflare KV and local state)
  const logout = useCallback(async () => {
    const currentToken = token || localStorage.getItem('auth_token');
    if (currentToken) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: 'application/json',
          },
        });
      } catch (err) {
        console.warn('[LOGOUT_REQUEST_FAILED]', err);
      }
    }
    persistAuth(null, null, [], null);
    setShowIdleWarning(false);
  }, [token]);

  // 4. Role & Scope Checkers
  const highestRole = user?.highestRole || null;

  const hasRole = useCallback(
    (allowedRoles: RoleIdentifier[]) => {
      if (!user) return false;
      if (user.highestRole === 'super_admin') return true;
      if (allowedRoles.includes(user.highestRole)) return true;
      return roles.some((r) => allowedRoles.includes(r.roleId as RoleIdentifier));
    },
    [user, roles]
  );

  const hasScope = useCallback(
    (scopeType: 'chamber' | 'chapter' | 'group', scopeId: string) => {
      return checkScopeAccess(roles, highestRole, scopeType, scopeId);
    },
    [roles, highestRole]
  );

  // 5. Idle Timeout Guardian (25-min warning, 30-min auto-logout)
  useEffect(() => {
    if (!token || !user) {
      setShowIdleWarning(false);
      return;
    }

    const recordUserActivity = () => {
      if (!showIdleWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, recordUserActivity, { passive: true }));

    idleCheckIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= TOTAL_IDLE_TIMEOUT_MS) {
        // 30 minutes expired -> perform automatic logout
        logout();
        setShowSessionExpired(true);
      } else if (elapsed >= IDLE_WARNING_MS) {
        // Between 25 and 30 minutes -> display countdown warning modal
        setShowIdleWarning(true);
        const remainingSeconds = Math.max(0, Math.round((TOTAL_IDLE_TIMEOUT_MS - elapsed) / 1000));
        setIdleCountdownSeconds(remainingSeconds);
      } else {
        setShowIdleWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordUserActivity));
      if (idleCheckIntervalRef.current) clearInterval(idleCheckIntervalRef.current);
    };
  }, [token, user, showIdleWarning, logout]);

  const extendSession = async () => {
    // Immediately reset idle tracking to stop the countdown
    lastActivityRef.current = Date.now();
    setShowIdleWarning(false);
    setIdleCountdownSeconds(300);

    // Call the dedicated session refresh endpoint that force-extends KV TTL
    const currentToken = localStorage.getItem('auth_token');
    if (currentToken) {
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok && res.status === 401) {
          // Session already expired in KV — trigger session expiry flow
          persistAuth(null, null, [], null);
          setShowSessionExpired(true);
        }
      } catch (err) {
        console.warn('[SESSION_EXTEND_FAILED]', err);
        // Fallback: try full profile refresh which also touches session via middleware
        await refreshSession();
      }
    }
  };

  const dismissSessionExpired = useCallback(() => {
    setShowSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        chamber,
        highestRole,
        isAuthenticated: !!token && !!user,
        isLoading,
        token,
        login,
        logout,
        refreshSession,
        hasRole,
        hasScope,
        showIdleWarning,
        idleCountdownSeconds,
        extendSession,
        showSessionExpired,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
