import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { User, Bell, Palette, Key } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Profile
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Name</p>
              <p className="mt-0.5">{session?.user?.name ?? 'Not set'}</p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground text-sm font-medium">Email</p>
              <p className="mt-0.5">{session?.user?.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Coming soon sections */}
        {[
          {
            icon: Palette,
            title: 'Style Profile',
            description: 'Configure your brand voice and style',
          },
          {
            icon: Bell,
            title: 'Notifications',
            description: 'Manage push notification preferences',
          },
          { icon: Key, title: 'API Keys', description: 'Connect third-party services' },
        ].map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="opacity-60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {section.title}
                  <Badge variant="outline" className="ml-auto text-xs">
                    Coming soon
                  </Badge>
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
