'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageIcon, UserPlus, ArrowRight, AlertCircle } from 'lucide-react';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signUp(email, password);
      if (error) throw error;
      router.push('/auth/signin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
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
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your details below to create your account
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full hover-scale"
            >
              {loading ? (
                <>
                  <span className="animate-pulse">Creating account...</span>
                </>
              ) : (
                <>
                  Sign up <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/signin" className="font-medium text-primary hover:text-primary/90 hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 