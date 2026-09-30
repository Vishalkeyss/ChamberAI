import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  loginPath?: string;
  currentPath?: string;
  onRedirectToLogin?: (targetLoginUrl: string) => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  loginPath = '/login',
  currentPath,
  onRedirectToLogin,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  const resolvedPath =
    currentPath || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (onRedirectToLogin) {
        onRedirectToLogin(resolvedPath);
      }
    }
  }, [isLoading, isAuthenticated, resolvedPath, onRedirectToLogin]);

  // Prevent UI screen flash with full-page skeleton shimmer during authentication resolution
  if (isLoading) {
    return (
      <div className="min-h-screen w-full p-6 space-y-6 bg-background animate-pulse">
        {/* Topbar skeleton */}
        <div className="flex items-center justify-between border-b pb-4 border-border/60">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        {/* Content viewport skeleton */}
        <div className="space-y-4 max-w-7xl mx-auto pt-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};
