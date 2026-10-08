import React, { useState } from 'react';
import { User as UserIcon, LogOut, Settings, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

export interface UserMenuProps {
  user: {
    id?: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
    businessName?: string;
  };
  onLogout?: () => Promise<void> | void;
  onEditProfile?: () => void;
  onAccountSettings?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onLogout,
  onEditProfile,
  onAccountSettings,
}) => {
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        // Fallback default: full logout (server session + local state), then go home
        await logout();
        window.location.href = '/';
      }
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const roleLabel = (user.role || 'member').replace(/_/g, ' ');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full p-0 ring-offset-background transition-all hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="User account menu"
          >
            <Avatar className="h-9 w-9 border border-white/10 dark:border-white/10 shadow-xs">
              {user.avatarUrl && (
                <AvatarImage
                  src={user.avatarUrl}
                  alt={user.name}
                  className="object-cover bg-white dark:bg-slate-900"
                />
              )}
              <AvatarFallback className="bg-[#1E3A5F] dark:bg-[#233F63] text-white font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl shadow-lg border-border" sideOffset={8}>
          <div className="flex items-center gap-3 p-2">
            <Avatar className="h-10 w-10 border border-border shrink-0">
              {user.avatarUrl && (
                <AvatarImage
                  src={user.avatarUrl}
                  alt={user.name}
                  className="object-cover bg-white dark:bg-slate-900"
                />
              )}
              <AvatarFallback className="bg-[#1E3A5F] dark:bg-[#233F63] text-white font-bold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user.businessName || user.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            className="gap-2.5 cursor-pointer py-2 px-2.5 rounded-lg font-medium text-sm text-foreground hover:bg-muted"
            onClick={onEditProfile}
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <span>Edit Profile</span>
          </DropdownMenuItem>
          {onAccountSettings && (
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer py-2 px-2.5 rounded-lg font-medium text-sm text-foreground hover:bg-muted"
              onClick={onAccountSettings}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Account Settings</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="my-1" />
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>All Systems Operational</span>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            className="gap-2.5 text-destructive focus:text-destructive cursor-pointer py-2 px-2.5 rounded-lg font-medium text-sm"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Modal: Are you sure you want to log out? */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
            <AlertDialogDescription>
              Your active session will be securely terminated. You can sign back in at any time
              using your email or phone number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              disabled={isLoggingOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoggingOut ? 'Logging out...' : 'Log Out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
