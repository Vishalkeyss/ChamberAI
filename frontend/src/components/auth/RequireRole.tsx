import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { type RoleIdentifier } from '@/core/context/AuthContext';
import { AccessDenied } from '@/components/common/AccessDenied';
import { ProtectedRoute } from './ProtectedRoute';

export interface RequireRoleProps {
  children: React.ReactNode;
  roles: RoleIdentifier[];
  fallback?: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  children,
  roles,
  fallback,
}) => {
  const { hasRole, highestRole } = useAuth();

  return (
    <ProtectedRoute>
      {hasRole(roles) ? (
        children
      ) : (
        fallback || (
          <AccessDenied
            role={highestRole || 'guest'}
            requiredRole={roles}
          />
        )
      )}
    </ProtectedRoute>
  );
};

export const RequireSuperAdmin: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => {
  return (
    <RequireRole roles={['super_admin']} fallback={fallback}>
      {children}
    </RequireRole>
  );
};
