import React, { useState } from 'react';
import { publicNavigation } from '@/core/navigation/public-navigation';
import { useTheme } from '@/core/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Menu, X, Sun, Moon, Laptop, ArrowRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface PublicNavbarProps {
  chamberName?: string;
  chamberLogoUrl?: string;
  onJoinClick?: () => void;
  onLoginClick?: () => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  chamberName = 'Greater Metro Chamber of Commerce',
  chamberLogoUrl,
  onJoinClick = () => (window.location.href = '/join'),
  onLoginClick = () => (window.location.href = '/login'),
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <a href="/" className="flex items-center gap-3 group">
          {chamberLogoUrl ? (
            <img src={chamberLogoUrl} alt={chamberName} className="h-9 w-9 rounded-md object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm transition-transform group-hover:scale-105">
              {chamberName.charAt(0)}
            </div>
          )}
          <span className="font-bold text-base md:text-lg tracking-tight truncate max-w-[220px] md:max-w-sm">
            {chamberName}
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {publicNavigation.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Desktop Action CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme">
                {theme === 'light' ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : theme === 'dark' ? (
                  <Moon className="h-4 w-4 text-blue-400" />
                ) : (
                  <Laptop className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" onClick={onLoginClick}>
            Sign In
          </Button>

          <Button
            size="sm"
            onClick={onJoinClick}
            className="bg-primary text-primary-foreground font-semibold shadow-sm hover:opacity-95 gap-1.5"
          >
            <span>Join Now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex lg:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-background px-4 pt-2 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-1">
            {publicNavigation.map((item) => (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-muted"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="pt-4 border-t border-border flex flex-col gap-2">
            <Button variant="outline" className="w-full justify-center" onClick={onLoginClick}>
              Sign In to Member Portal
            </Button>
            <Button className="w-full justify-center gap-2" onClick={onJoinClick}>
              <span>Join Chamber Today</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
