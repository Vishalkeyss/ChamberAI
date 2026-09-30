import React from 'react';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface AccessDeniedProps {
  role?: string;
  isOutOfScope?: boolean;
  requiredRole?: string | string[];
  targetScopeName?: string;
  onReturn?: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  role = 'guest',
  isOutOfScope = false,
  requiredRole,
  targetScopeName,
  onReturn,
}) => {
  const formattedRole = role.replace(/_/g, ' ');

  const handleReturn = () => {
    if (onReturn) {
      onReturn();
    } else {
      if (role === 'super_admin') {
        window.location.href = '/super-admin';
      } else if (
        role === 'full_admin' ||
        role === 'chapter_admin' ||
        role === 'billing_admin' ||
        role === 'group_admin'
      ) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/portal';
      }
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/20 shadow-lg text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-3 ring-8 ring-destructive/5">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isOutOfScope ? 'Out of Scope' : 'Access Restricted'}
          </CardTitle>
          <CardDescription className="text-sm mt-1">
            {isOutOfScope
              ? `This module is restricted to records assigned to ${targetScopeName || 'your authorized chapter/group'}.`
              : 'You do not have permission to view this module.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3.5 bg-muted/60 rounded-xl border border-border/60 text-xs text-muted-foreground flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span>Your Authenticated Role:</span>
              <Badge variant="outline" className="capitalize font-semibold text-foreground">
                {formattedRole}
              </Badge>
            </div>
            {requiredRole && (
              <div className="flex items-center justify-between">
                <span>Required Permission:</span>
                <span className="font-mono text-destructive font-medium">
                  {Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            If you believe you should have access to this resource, please contact your chamber administrator.
          </p>
        </CardContent>
        <CardFooter className="flex gap-2 justify-center pt-2">
          <Button onClick={handleReturn} className="gap-2">
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
