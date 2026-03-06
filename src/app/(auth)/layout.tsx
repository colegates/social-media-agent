import { Zap } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="text-foreground mb-8 flex items-center gap-2 hover:opacity-80">
        <Zap className="text-primary h-7 w-7" />
        <span className="text-xl font-semibold">Social Agent</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
