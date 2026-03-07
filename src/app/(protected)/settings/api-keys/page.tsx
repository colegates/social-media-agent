import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getUserApiKeyStatus } from '@/lib/services/api-keys';
import { ApiKeysManager } from '@/components/features/settings/ApiKeysManager';

export const metadata: Metadata = {
  title: 'API Keys – Settings',
};

export default async function ApiKeysPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const statuses = await getUserApiKeyStatus(userId);
  const hintMap = Object.fromEntries(statuses.map((s) => [s.service, s.keyHint]));

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Connect your own accounts for each service. Keys are encrypted and stored securely — only
          you can use them.
        </p>
      </div>

      <ApiKeysManager hintMap={hintMap} />
    </div>
  );
}
