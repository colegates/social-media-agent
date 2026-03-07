'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { IdeaCard } from './IdeaCard';
import type { IdeaCardData } from './IdeaCard';
import type { ContentIdeaStatus } from '@/db/schema';

interface IdeasFeedProps {
  initialIdeas: IdeaCardData[];
  totalCount: number;
  page: number;
  filters: Record<string, string>;
}

// Swipe gesture state
interface SwipeState {
  ideaId: string;
  startX: number;
  currentX: number;
  deltaX: number;
}

export function IdeasFeed({ initialIdeas, totalCount, page, filters }: IdeasFeedProps) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaCardData[]>(initialIdeas);
  const [swipe, setSwipe] = useState<SwipeState | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const swipeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleStatusChange = useCallback((id: string, status: ContentIdeaStatus) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === id ? { ...idea, status } : idea)));
  }, []);

  // Touch swipe handlers for mobile Tinder-style UX
  function handleTouchStart(ideaId: string, e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    setSwipe({ ideaId, startX: touch.clientX, currentX: touch.clientX, deltaX: 0 });
    setSwipingId(ideaId);
  }

  function handleTouchMove(ideaId: string, e: React.TouchEvent) {
    if (!swipe || swipe.ideaId !== ideaId) return;
    const touch = e.touches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipe.startX;
    setSwipe((s) => (s ? { ...s, currentX: touch.clientX, deltaX } : null));

    const el = swipeRefs.current.get(ideaId);
    if (el) {
      el.style.transform = `translateX(${deltaX}px)`;
      el.style.opacity = String(Math.max(0.3, 1 - Math.abs(deltaX) / 200));
    }
  }

  async function handleTouchEnd(idea: IdeaCardData) {
    if (!swipe || swipe.ideaId !== idea.id) return;

    const el = swipeRefs.current.get(idea.id);
    const SWIPE_THRESHOLD = 80;

    if (Math.abs(swipe.deltaX) > SWIPE_THRESHOLD && idea.status === 'suggested') {
      const action = swipe.deltaX > 0 ? 'approve' : 'reject';
      try {
        const res = await fetch(`/api/ideas/${idea.id}/${action}`, { method: 'POST' });
        if (res.ok) {
          const newStatus = action === 'approve' ? 'approved' : 'rejected';
          handleStatusChange(idea.id, newStatus as ContentIdeaStatus);
          toast.success(action === 'approve' ? 'Approved!' : 'Rejected');
        }
      } catch {
        toast.error('Failed to update');
      }
    }

    // Reset card position
    if (el) {
      el.style.transform = '';
      el.style.opacity = '';
    }

    setSwipe(null);
    setSwipingId(null);
  }

  const hasNextPage = ideas.length < totalCount;

  return (
    <div className="space-y-3">
      {ideas.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm">No content ideas found.</p>
          <p className="mt-1 text-xs">
            Run a trend scan or use the Generate button to create ideas.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile hint */}
          <p className="text-muted-foreground px-1 text-xs md:hidden">
            Swipe right to approve, left to reject
          </p>

          {ideas.map((idea) => (
            <div
              key={idea.id}
              ref={(el) => {
                if (el) swipeRefs.current.set(idea.id, el);
                else swipeRefs.current.delete(idea.id);
              }}
              className="transition-transform duration-150"
              style={{ touchAction: idea.status === 'suggested' ? 'pan-y' : undefined }}
              onTouchStart={
                idea.status === 'suggested' ? (e) => handleTouchStart(idea.id, e) : undefined
              }
              onTouchMove={
                idea.status === 'suggested' ? (e) => handleTouchMove(idea.id, e) : undefined
              }
              onTouchEnd={idea.status === 'suggested' ? () => handleTouchEnd(idea) : undefined}
            >
              {/* Swipe direction indicator (mobile) */}
              {swipingId === idea.id && swipe && (
                <div
                  className={`absolute inset-y-2 rounded-lg border-2 opacity-0 transition-opacity ${
                    swipe.deltaX > 20
                      ? 'right-auto left-2 border-emerald-400 opacity-100'
                      : swipe.deltaX < -20
                        ? 'right-2 left-auto border-rose-400 opacity-100'
                        : ''
                  }`}
                  aria-hidden="true"
                />
              )}
              <IdeaCard idea={idea} onStatusChange={handleStatusChange} />
            </div>
          ))}

          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams({ ...filters, page: String(page + 1) });
                  router.push(`/content/ideas?${params.toString()}`);
                }}
              >
                Load more ({totalCount - ideas.length} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
