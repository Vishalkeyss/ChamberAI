import React from 'react';
import { cn } from '@/lib/utils';
import { initials } from '../services/networking.api';

interface MemberAvatarProps {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'w-8 h-8 text-[11px]', md: 'w-10 h-10 text-xs', lg: 'w-12 h-12 text-sm' };

/** Avatar image, or initials on the brand colour when the member has no photo. */
export const MemberAvatar: React.FC<MemberAvatarProps> = ({ name, avatarUrl, size = 'md', className }) => (
  <div
    className={cn(
      'rounded-full shrink-0 overflow-hidden flex items-center justify-center font-bold bg-primary text-primary-foreground',
      SIZES[size],
      className
    )}
  >
    {avatarUrl ? <img src={avatarUrl} alt={name || ''} className="w-full h-full object-cover" /> : initials(name)}
  </div>
);
