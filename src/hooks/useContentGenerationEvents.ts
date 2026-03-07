'use client';

import { useEffect, useRef, useCallback } from 'react';

export type GenerationEventType =
  | 'connected'
  | 'generation_started'
  | 'generation_complete'
  | 'generation_failed'
  | 'all_complete'
  | 'timeout'
  | 'error';

export interface GenerationEvent {
  type: GenerationEventType;
  data: {
    contentId?: string;
    ideaId?: string;
    type?: string;
    storageUrl?: string;
    thumbnailUrl?: string;
    aiToolUsed?: string;
    generationCost?: string;
    count?: number;
    message?: string;
  };
}

interface UseContentGenerationEventsOptions {
  onEvent?: (event: GenerationEvent) => void;
  onComplete?: () => void;
  enabled?: boolean;
}

export function useContentGenerationEvents(
  ideaId: string,
  options: UseContentGenerationEventsOptions = {}
): void {
  const { onEvent, onComplete, enabled = true } = options;
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !ideaId) return;

    // Close existing connection
    esRef.current?.close();

    const es = new EventSource(`/api/content/events?ideaId=${ideaId}`);
    esRef.current = es;

    const eventTypes: GenerationEventType[] = [
      'connected',
      'generation_started',
      'generation_complete',
      'generation_failed',
      'all_complete',
      'timeout',
      'error',
    ];

    for (const eventType of eventTypes) {
      es.addEventListener(eventType, (e: MessageEvent<string>) => {
        const data = JSON.parse(e.data) as GenerationEvent['data'];
        onEvent?.({ type: eventType, data });

        if (eventType === 'all_complete' || eventType === 'timeout') {
          es.close();
          onComplete?.();
        }
      });
    }

    es.onerror = () => {
      es.close();
    };
  }, [ideaId, enabled, onEvent, onComplete]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);
}
