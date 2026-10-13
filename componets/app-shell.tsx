'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Dumbbell,
  Library,
  MessageSquare,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workout', label: 'Workout', icon: Dumbbell },
  { href: '/exercises', label: 'Exercises', icon: Library },
  { href: '/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const firstName = profile?.full_name?.split(' ')[0] || 'Athlete';

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 z-30 h-screen w-64 flex-col border-r border-border bg-card/50 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">SmartFit AI</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Personal Trainer</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                <item.icon className="h-4.5 w-4.5" style={{ width: '1.125rem', height: '1.125rem' }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
              {firstName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{firstName}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="w-full justify-start text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold">SmartFit AI</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-card border-b border-border p-3 space-y-1 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all',
                    active
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:text-destructive w-full"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-border bg-card/95 backdrop-blur-xl flex items-center justify-around px-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', active && 'text-primary')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
