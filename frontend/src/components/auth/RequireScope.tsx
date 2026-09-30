import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/common/AccessDenied';
import { ProtectedRoute } from './ProtectedRoute';

export interface RequireScopeProps {
  children: React.ReactNode;
  scopeType: 'chamber' | 'chapter' | 'group';
  scopeId: string;
  scopeName?: string;
  fallback?: React.ReactNode;
}

export const RequireScope: React.FC<RequireScopeProps> = ({
  children,
  scopeType,
  scopeId,
  scopeName,
  fallback,
}) => {
  const { hasScope, highestRole } = useAuth();

  return (
    <ProtectedRoute>
      {hasScope(scopeType, scopeId) ? (
        children
      ) : (
        fallback || (
          <AccessDenied
            role={highestRole || 'member'}
            isOutOfScope
            targetScopeName={scopeName || `${scopeType} (${scopeId})`}
          />
        )
      )}
    </ProtectedRoute>
  );
};
