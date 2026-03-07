import { logger } from '@/lib/logger';
import { uploadFile, buildStoragePath } from '@/lib/storage/r2';
import type { StyleProfile } from '@/types';
import Anthropic from '@anthropic-ai/sdk';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────

const API_TIMEOUT_MS = 300_000; // 5 minutes - video gen can take a long time
const POLL_INTERVAL_MS = 10_000; // Poll every 10 seconds
const MAX_POLL_ATTEMPTS = 30; // 5 minutes total polling
const MAX_RETRY_COUNT = 2;
const BASE_RETRY_DELAY_MS = 3000;

// Estimated costs (USD per generation)
const COST_ESTIMATES = {
  kling: 0.35, // ~$0.35 per 5s video
  runway: 0.5, // ~$0.50 per generation
} as const;

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export interface VideoGenerationOptions {
  duration?: 5 | 10; // seconds
  aspectRatio?: VideoAspectRatio;
  imageRef?: string; // URL of reference image for image-to-video
}

export interface GeneratedVideoResult {
  buffer: Buffer;
  storageUrl: string;
  thumbnailUrl: string | null;
  aiToolUsed: string;
  estimatedCost: number;
  promptUsed: string;
}

// ─────────────────────────────────────────────────────────
// Retry helper
// ─────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, context: string, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempt >= MAX_RETRY_COUNT) {
      logger.error({ context, attempt, error }, 'Video generator: max retries exceeded');
      throw error;
    }
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
    logger.warn({ context, attempt, delay }, 'Video generator: retrying after backoff');
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, context, attempt + 1);
  }
}

// ─────────────────────────────────────────────────────────
// Prompt Enhancement via Claude
// ─────────────────────────────────────────────────────────

async function enhanceVideoPromptWithClaude(
  visualDirection: string,
  styleProfile: StyleProfile | null,
  duration: number,
  aspectRatio: VideoAspectRatio
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return visualDirection;

  const client = new Anthropic({ apiKey });
  const promptLogger = logger.child({ fn: 'enhanceVideoPromptWithClaude' });

  const formatContext: Record<VideoAspectRatio, string> = {
    '16:9': 'landscape video (YouTube/blog)',
    '9:16': 'vertical video (TikTok/Reels/Stories)',
    '1:1': 'square video (Instagram)',
  };

  const styleContext = styleProfile
    ? `Brand: ${styleProfile.tone}. Themes: ${styleProfile.contentThemes.join(', ')}.`
    : '';

  const systemPrompt = `You are an expert at writing text-to-video prompts for AI video generation tools like Kling AI.
Convert a content visual direction into a detailed, cinematic video prompt.

Rules:
- Describe motion and camera movement explicitly (pan, zoom, tracking shot, etc.)
- Include subject action, environment, lighting, mood
- Be specific about transitions and visual flow
- Keep under 150 words
- Output ONLY the prompt text, no explanation`;

  const userPrompt = `Visual direction: ${visualDirection}
${styleContext}
Target: ${duration}-second ${formatContext[aspectRatio]}

Write an optimised video generation prompt:`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return visualDirection;

    promptLogger.debug(
      { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      'Claude: video prompt enhancement complete'
    );

    return content.text.trim();
  } catch (error) {
    promptLogger.warn({ error }, 'Claude video prompt enhancement failed, using raw direction');
    return visualDirection;
  }
}

// ─────────────────────────────────────────────────────────
// Kling AI (Primary)
// ─────────────────────────────────────────────────────────

interface KlingTask {
  code: number;
  message: string;
  data: {
    task_id: string;
    task_status: string;
    task_status_msg?: string;
    videos?: Array<{ url: string; duration: string }>;
  };
}

async function klingRequest(
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<KlingTask> {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) {
    throw new Error('KLING_API_KEY environment variable is not set');
  }

  const response = await fetch(`https://api.klingai.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kling API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<KlingTask>;
}

export async function generateVideoKling(
  prompt: string,
  options: VideoGenerationOptions = {}
): Promise<Buffer> {
  const klingLogger = logger.child({ fn: 'generateVideoKling' });
  const { duration = 5, aspectRatio = '16:9', imageRef } = options;

  klingLogger.info(
    { prompt: prompt.slice(0, 100), duration, aspectRatio, estimatedCost: COST_ESTIMATES.kling },
    'Kling: starting video generation'
  );

  const start = Date.now();

  const aspectRatioMap: Record<VideoAspectRatio, string> = {
    '16:9': '16:9',
    '9:16': '9:16',
    '1:1': '1:1',
  };

  // Create task
  const endpoint = imageRef ? '/v1/videos/image2video' : '/v1/videos/text2video';
  const taskResponse = await withRetry(
    () =>
      klingRequest(endpoint, 'POST', {
        prompt,
        duration: String(duration),
        aspect_ratio: aspectRatioMap[aspectRatio],
        ...(imageRef ? { image_url: imageRef } : {}),
        mode: 'std',
        cfg_scale: 0.5,
      }),
    'generateVideoKling'
  );

  if (taskResponse.code !== 0) {
    throw new Error(`Kling task creation failed: ${taskResponse.message}`);
  }

  const taskId = taskResponse.data.task_id;
  klingLogger.info({ taskId }, 'Kling: task created, polling for completion');

  // Poll for completion
  let pollAttempts = 0;
  let videoUrl: string | null = null;

  while (pollAttempts < MAX_POLL_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    pollAttempts++;

    const statusResponse = await klingRequest(`/v1/videos/text2video/${taskId}`, 'GET');

    const status = statusResponse.data.task_status;
    klingLogger.debug({ taskId, status, pollAttempts }, 'Kling: polling status');

    if (status === 'succeed' || status === 'completed') {
      videoUrl = statusResponse.data.videos?.[0]?.url ?? null;
      break;
    }

    if (status === 'failed') {
      throw new Error(
        `Kling video generation failed: ${statusResponse.data.task_status_msg ?? 'Unknown error'}`
      );
    }
  }

  if (!videoUrl) {
    throw new Error('Kling video generation timed out or returned no URL');
  }

  // Download the video
  const videoResponse = await Promise.race([
    fetch(videoUrl),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Video download timed out')), API_TIMEOUT_MS)
    ),
  ]);

  const arrayBuffer = await videoResponse.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);

  const duration_ms = Date.now() - start;
  klingLogger.info(
    { duration: duration_ms, size: videoBuffer.length, estimatedCost: COST_ESTIMATES.kling },
    'Kling: video generation complete'
  );

  return videoBuffer;
}

// ─────────────────────────────────────────────────────────
// Runway Gen-3 (Secondary)
// ─────────────────────────────────────────────────────────

interface RunwayTask {
  id: string;
  status: string;
  output?: string[];
  failure?: string;
  failureCode?: string;
}

export async function generateVideoRunway(
  prompt: string,
  options: VideoGenerationOptions = {}
): Promise<Buffer> {
  const runwayLogger = logger.child({ fn: 'generateVideoRunway' });
  const { duration = 5, imageRef } = options;

  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error('RUNWAY_API_KEY environment variable is not set');
  }

  runwayLogger.info(
    { prompt: prompt.slice(0, 100), duration, estimatedCost: COST_ESTIMATES.runway },
    'Runway: starting video generation'
  );

  const start = Date.now();

  // Create generation task
  const createResponse = await withRetry(
    () =>
      fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Runway-Version': '2024-11-06',
        },
        body: JSON.stringify({
          promptText: prompt,
          ...(imageRef ? { promptImage: imageRef } : {}),
          model: 'gen3a_turbo',
          duration,
          ratio: '1280:768',
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Runway API error ${res.status}: ${text}`);
        }
        return res.json() as Promise<RunwayTask>;
      }),
    'generateVideoRunway'
  );

  const taskId = createResponse.id;
  runwayLogger.info({ taskId }, 'Runway: task created, polling for completion');

  // Poll for completion
  let pollAttempts = 0;
  let videoUrl: string | null = null;

  while (pollAttempts < MAX_POLL_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    pollAttempts++;

    const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    const status = (await statusResponse.json()) as RunwayTask;
    runwayLogger.debug({ taskId, status: status.status, pollAttempts }, 'Runway: polling status');

    if (status.status === 'SUCCEEDED') {
      videoUrl = status.output?.[0] ?? null;
      break;
    }

    if (status.status === 'FAILED') {
      throw new Error(`Runway video generation failed: ${status.failure ?? 'Unknown error'}`);
    }
  }

  if (!videoUrl) {
    throw new Error('Runway video generation timed out or returned no URL');
  }

  const videoResponse = await fetch(videoUrl);
  const arrayBuffer = await videoResponse.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);

  const duration_ms = Date.now() - start;
  runwayLogger.info(
    { duration: duration_ms, size: videoBuffer.length, estimatedCost: COST_ESTIMATES.runway },
    'Runway: video generation complete'
  );

  return videoBuffer;
}

// ─────────────────────────────────────────────────────────
// Video Generator Orchestrator
// ─────────────────────────────────────────────────────────

export interface VideoOrchestrationInput {
  contentIdeaId: string;
  userId: string;
  visualDirection: string;
  styleProfile: StyleProfile | null;
  options?: VideoGenerationOptions;
}

export async function orchestrateVideoGeneration(
  input: VideoOrchestrationInput
): Promise<GeneratedVideoResult> {
  const orchLogger = logger.child({
    fn: 'orchestrateVideoGeneration',
    contentIdeaId: input.contentIdeaId,
    userId: input.userId,
  });

  const aspectRatio = input.options?.aspectRatio ?? '16:9';
  const duration = input.options?.duration ?? 5;

  const enhancedPrompt = await enhanceVideoPromptWithClaude(
    input.visualDirection,
    input.styleProfile,
    duration,
    aspectRatio
  );

  orchLogger.info({ aspectRatio, duration }, 'Video orchestrator: starting generation');

  let videoBuffer: Buffer;
  let aiToolUsed: string;
  let estimatedCost: number;

  const hasKling = !!process.env.KLING_API_KEY;
  const hasRunway = !!process.env.RUNWAY_API_KEY;

  if (hasKling) {
    try {
      videoBuffer = await generateVideoKling(enhancedPrompt, input.options);
      aiToolUsed = 'kling';
      estimatedCost = COST_ESTIMATES.kling;
    } catch (klingError) {
      orchLogger.warn({ error: klingError }, 'Kling failed, falling back to Runway');
      if (!hasRunway) throw klingError;
      videoBuffer = await generateVideoRunway(enhancedPrompt, input.options);
      aiToolUsed = 'runway';
      estimatedCost = COST_ESTIMATES.runway;
    }
  } else if (hasRunway) {
    videoBuffer = await generateVideoRunway(enhancedPrompt, input.options);
    aiToolUsed = 'runway';
    estimatedCost = COST_ESTIMATES.runway;
  } else {
    throw new Error('No video generation service configured. Set KLING_API_KEY or RUNWAY_API_KEY.');
  }

  // Upload video to R2
  const videoFilename = `video-${Date.now()}.mp4`;
  const videoKey = buildStoragePath(input.userId, input.contentIdeaId, videoFilename);
  const storageUrl = await uploadFile(videoBuffer, videoKey, 'video/mp4');

  orchLogger.info(
    { aiToolUsed, estimatedCost, storageUrl },
    'Video orchestrator: generation and upload complete'
  );

  return {
    buffer: videoBuffer,
    storageUrl,
    thumbnailUrl: null, // Thumbnail extraction would require ffmpeg - skipped for now
    aiToolUsed,
    estimatedCost,
    promptUsed: enhancedPrompt,
  };
}
