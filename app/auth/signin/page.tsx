'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageIcon, LogIn, ArrowRight, AlertCircle } from 'lucide-react';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log("User already logged in, redirecting...");
        window.location.href = '/';
      }
    };
    
    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { error, data } = await signIn(email, password);
      
      if (error) {
        throw error;
      }
      
      if (data?.session) {
        console.log("Login successful, redirecting...");
        
        // Redirect to home page
        window.location.href = '/';
      } else {
        setError("Login successful but no session was created. Please try again.");
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="flex items-center">
              <ImageIcon className="h-6 w-6 text-primary mr-2" />
              <span className="text-xl font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                ImageCraft
              </span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center space-x-2 rounded-md bg-destructive/15 p-3 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <div className="text-sm">{error}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={isSubmitting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:bg-muted disabled:cursor-not-allowed"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={isSubmitting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:bg-muted disabled:cursor-not-allowed"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full hover-scale"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            
            <div className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="font-medium text-primary hover:text-primary/90 hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 