import { type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { generatedContent } from '@/db/schema';
import { logger } from '@/lib/logger';

const POLL_INTERVAL_MS = 2000;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes max

export async function GET(req: NextRequest): Promise<Response> {
  const sseLogger = logger.child({ route: 'GET /api/content/events' });

  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userId = session.user.id;

  const ideaId = req.nextUrl.searchParams.get('ideaId');
  if (!ideaId) {
    return new Response('Missing ideaId query parameter', { status: 400 });
  }

  sseLogger.info({ userId, ideaId }, 'SSE connection opened');

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown): void {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      }

      // Send initial connection event
      send('connected', { ideaId, userId });

      const previousStatuses = new Map<string, string>();

      const poll = async (): Promise<void> => {
        try {
          const contents = await db
            .select({
              id: generatedContent.id,
              type: generatedContent.type,
              status: generatedContent.status,
              storageUrl: generatedContent.storageUrl,
              thumbnailUrl: generatedContent.thumbnailUrl,
              aiToolUsed: generatedContent.aiToolUsed,
              generationCost: generatedContent.generationCost,
              updatedAt: generatedContent.updatedAt,
            })
            .from(generatedContent)
            .where(
              and(eq(generatedContent.contentIdeaId, ideaId), eq(generatedContent.userId, userId))
            );

          for (const item of contents) {
            const prev = previousStatuses.get(item.id);

            if (prev !== item.status) {
              previousStatuses.set(item.id, item.status);

              if (item.status === 'generating' && !prev) {
                send('generation_started', {
                  contentId: item.id,
                  type: item.type,
                  ideaId,
                });
              } else if (item.status === 'completed') {
                send('generation_complete', {
                  contentId: item.id,
                  type: item.type,
                  ideaId,
                  storageUrl: item.storageUrl,
                  thumbnailUrl: item.thumbnailUrl,
                  aiToolUsed: item.aiToolUsed,
                  generationCost: item.generationCost,
                });
              } else if (item.status === 'failed') {
                send('generation_failed', {
                  contentId: item.id,
                  type: item.type,
                  ideaId,
                });
              }
            }
          }

          // Check if all items are terminal (completed/failed)
          if (contents.length > 0) {
            const allDone = contents.every(
              (c) => c.status === 'completed' || c.status === 'failed'
            );
            if (allDone) {
              send('all_complete', { ideaId, count: contents.length });
              controller.close();
              return;
            }
          }

          // Timeout check
          if (Date.now() - startTime > MAX_DURATION_MS) {
            send('timeout', { ideaId });
            controller.close();
            return;
          }

          // Continue polling
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          await poll();
        } catch (error) {
          sseLogger.error({ error, userId, ideaId }, 'SSE polling error');
          send('error', { message: 'Polling error' });
          controller.close();
        }
      };

      await poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
