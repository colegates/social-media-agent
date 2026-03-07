import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Bell, Palette, Key, ChevronRight, Database, Monitor } from 'lucide-react';
import { LogoutButton } from '@/components/features/settings/LogoutButton';
import { DataManagementClient } from '@/components/features/settings/DataManagementClient';

export const metadata: Metadata = {
  title: 'Settings',
};

const SETTINGS_LINKS = [
  {
    href: '/settings/profile',
    icon: User,
    title: 'Profile',
    description: 'Update your name and change your password',
  },
  {
    href: '/settings/style',
    icon: Palette,
    title: 'Style Profile',
    description: 'Configure your brand voice and style for AI generation',
  },
  {
    href: '/settings/api-keys',
    icon: Key,
    title: 'API Keys',
    description: 'Connect Anthropic, SerpAPI, Apify, Twitter, and more',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Manage push notification preferences per event type',
  },
  {
    href: '/settings/automation',
    icon: Monitor,
    title: 'Automation',
    description: 'Configure global automation rules and schedules',
  },
];

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences ·{' '}
          <span className="font-medium">{session?.user?.email}</span>
        </p>
      </div>

      <div className="max-w-2xl space-y-3">
        {SETTINGS_LINKS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <Card className="hover:bg-accent/50 cursor-pointer transition-colors">
              <CardHeader className="py-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {title}
                  <ChevronRight className="text-muted-foreground ml-auto h-4 w-4" />
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Data Management
            </CardTitle>
            <CardDescription>
              Permanently delete old trends, scan history, or content ideas to keep your workspace
              clean.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataManagementClient />
          </CardContent>
        </Card>

        {/* Sign out */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Manage your session</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
