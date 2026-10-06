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
    <div className='w-full max-w-7xl ml-auto mr-auto px-4 py-6'>
      <DirectoryPage
        mode="public"
        chamberName={chamberName}
        chamberSlug={chamberSlug}
        onNavigateToPlans={onNavigateToPlans}
      />
    </div>
  );
};
