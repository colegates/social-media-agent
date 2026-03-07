'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <Button
      variant="destructive"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full sm:w-auto"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </Button>
  );
}
