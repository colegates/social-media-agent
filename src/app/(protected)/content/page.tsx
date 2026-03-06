import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Content',
};

export default function ContentPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content</h1>
        <p className="text-muted-foreground mt-1">Manage your content ideas and generated assets</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            No content yet
          </CardTitle>
          <CardDescription>
            Content ideas and generated assets will appear here once you set up topics and run your
            first trend scan.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
