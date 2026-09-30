import React from 'react';
import { PublicNavbar } from './PublicNavbar';
import { PublicFooter } from './PublicFooter';

export interface PublicLayoutProps {
  children?: React.ReactNode;
  chamberName?: string;
  chamberLogoUrl?: string;
  onJoinClick?: () => void;
  onLoginClick?: () => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  chamberName,
  chamberLogoUrl,
  onJoinClick,
  onLoginClick,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PublicNavbar
        chamberName={chamberName}
        chamberLogoUrl={chamberLogoUrl}
        onJoinClick={onJoinClick}
        onLoginClick={onLoginClick}
      />
      <main className="flex-1 w-full">{children}</main>
      <PublicFooter chamberName={chamberName} />
    </div>
  );
};
