'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, User, Plus, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar({ onNewProject }: { onNewProject: () => void }) {
  const { user, signOut, loading } = useAuth();
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
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <ImageIcon className="h-5 w-5 text-primary mr-2" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">ImageCraft</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewProject}
              className="ml-4 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              title="New Project"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-3">
            {loading ? (
              <div className="h-8 w-24 bg-secondary animate-pulse rounded-md"></div>
            ) : user ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center text-xs bg-secondary/50 px-2.5 py-1 rounded-full border border-border/50">
                  <User className="h-3 w-3 mr-1.5 text-primary" />
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
                  className="flex items-center hover:bg-secondary/80 text-xs py-1 px-2.5 h-auto"
                >
                  <LogOut className="h-3 w-3 mr-1.5" />
                  <span>Sign out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm" className="hover:bg-secondary/80 text-xs py-1 px-2.5 h-auto">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="default" size="sm" className="hover-scale text-xs py-1 px-2.5 h-auto">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 