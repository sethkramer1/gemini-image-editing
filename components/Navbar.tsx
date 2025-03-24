'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, signOut, loading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth/signin';
  };

  return (
    <nav className="border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold">Image Editor</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {loading ? (
              <span className="text-muted-foreground text-sm">Loading...</span>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="hidden md:inline text-foreground">
                    {user.email}
                  </span>
                  <span className="md:hidden text-foreground">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  size="sm"
                  className="flex items-center"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Sign out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="default" size="sm">Sign up</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 