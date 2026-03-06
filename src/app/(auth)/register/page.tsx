import type { Metadata } from 'next';
import { RegisterForm } from '@/components/forms/RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Create Account',
};

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start scanning trends and generating content today</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
