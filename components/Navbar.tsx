'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, Moon, Sun, Image as ImageIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const { user, signOut, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/signin';
  };

  return (
    <nav className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <ImageIcon className="h-6 w-6 text-primary mr-2" />
              <span className="text-xl font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">ImageCraft</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {!mounted ? null : (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            )}
            
            {loading ? (
              <div className="h-8 w-24 bg-secondary animate-pulse rounded-md"></div>
            ) : user ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center text-sm bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
                  <User className="h-4 w-4 mr-2 text-primary" />
                  <span className="hidden md:inline font-medium">
                    {user.email}
                  </span>
                  <span className="md:hidden font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="sm"
                  className="flex items-center hover:bg-secondary/80"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Sign out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm" className="hover:bg-secondary/80">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="default" size="sm" className="hover-scale">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 