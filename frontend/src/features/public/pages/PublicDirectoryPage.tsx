import React from 'react';
import { DirectoryPage } from '@/features/directory/pages/DirectoryPage';

export interface PublicDirectoryPageProps {
  chamberName?: string;
  chamberSlug?: string;
  onNavigateToPlans?: () => void;
}

export const PublicDirectoryPage: React.FC<PublicDirectoryPageProps> = ({
  chamberName,
  chamberSlug,
  onNavigateToPlans,
}) => {
  return (
    <div className="px-8 py-14 max-w-7xl mx-auto w-full">
      <DirectoryPage
        mode="public"
        chamberName={chamberName}
        chamberSlug={chamberSlug}
        onNavigateToPlans={onNavigateToPlans}
      />
    </div>
  );
};
