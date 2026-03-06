import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked, Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Topics',
};

export default function TopicsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Topics</h1>
          <p className="text-muted-foreground mt-1">Manage your trend monitoring topics</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Topic
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5" />
            No topics yet
          </CardTitle>
          <CardDescription>
            Create your first topic to start monitoring trends across social media platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Create your first topic
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
