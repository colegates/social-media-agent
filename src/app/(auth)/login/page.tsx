import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Sign In',
};

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
