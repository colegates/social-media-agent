import Replicate from 'replicate';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { uploadFile, buildStoragePath } from '@/lib/storage/r2';
import type { StyleProfile } from '@/types';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────

const FLUX_MODEL = 'black-forest-labs/flux-1.1-pro';
const MAX_RETRY_COUNT = 2;
const BASE_RETRY_DELAY_MS = 2000;
const API_TIMEOUT_MS = 120_000; // 2 minutes - image generation can take a while

// Estimated costs (USD per generation)
const COST_ESTIMATES = {
  flux: 0.04,
  dalle3: 0.04,
} as const;

export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5';

export interface ImageGenerationOptions {
  aspectRatio?: AspectRatio;
  style?: string;
  negativePrompt?: string;
}

export interface GeneratedImageResult {
  buffer: Buffer;
  storageUrl: string;
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
      logger.error({ context, attempt, error }, 'Image generator: max retries exceeded');
      throw error;
    }
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
    logger.warn({ context, attempt, delay }, 'Image generator: retrying after backoff');
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, context, attempt + 1);
  }
}

// ─────────────────────────────────────────────────────────
// Prompt Enhancement via Claude
// ─────────────────────────────────────────────────────────

async function enhancePromptWithClaude(
  visualDirection: string,
  styleProfile: StyleProfile | null,
  aspectRatio: AspectRatio
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fall back to raw visual direction if Claude is not configured
    return visualDirection;
  }

  const client = new Anthropic({ apiKey });
  const promptLogger = logger.child({ fn: 'enhancePromptWithClaude' });

  const aspectContext: Record<AspectRatio, string> = {
    '1:1': 'square format (Instagram post)',
    '9:16': 'vertical format (Stories, Reels, TikTok)',
    '16:9': 'landscape format (YouTube, blog header)',
    '4:5': 'portrait format (Instagram portrait)',
  };

  const styleContext = styleProfile
    ? `Brand aesthetic: ${styleProfile.tone}. Themes: ${styleProfile.contentThemes.join(', ')}.`
    : '';

  const systemPrompt = `You are an expert at writing text-to-image prompts for Flux AI image generation.
Convert a content visual direction into a detailed, optimised Flux prompt.

Rules:
- Be highly specific about visual elements, lighting, composition, style
- Use artistic terminology (cinematic, bokeh, golden hour, etc.)
- Include subject, setting, mood, colour palette
- Keep it under 200 words
- Output ONLY the prompt text, no explanation`;

  const userPrompt = `Visual direction: ${visualDirection}
${styleContext}
Target format: ${aspectContext[aspectRatio]}

Write an optimised Flux image generation prompt:`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return visualDirection;

    promptLogger.debug(
      { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      'Claude: prompt enhancement complete'
    );

    return content.text.trim();
  } catch (error) {
    promptLogger.warn({ error }, 'Claude prompt enhancement failed, using raw direction');
    return visualDirection;
  }
}

// ─────────────────────────────────────────────────────────
// Flux via Replicate (Primary)
// ─────────────────────────────────────────────────────────

export async function generateImageFlux(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<Buffer> {
  const fluxLogger = logger.child({ fn: 'generateImageFlux', model: FLUX_MODEL });

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN environment variable is not set');
  }

  const { aspectRatio = '1:1', negativePrompt } = options;

  const aspectRatioMap: Record<AspectRatio, string> = {
    '1:1': '1:1',
    '9:16': '9:16',
    '16:9': '16:9',
    '4:5': '4:5',
  };

  fluxLogger.info(
    { prompt: prompt.slice(0, 100), aspectRatio, estimatedCost: COST_ESTIMATES.flux },
    'Flux: starting image generation'
  );

  const start = Date.now();

  const replicate = new Replicate({ auth: apiToken });

  const output = await withRetry(
    () =>
      Promise.race([
        replicate.run(FLUX_MODEL as `${string}/${string}`, {
          input: {
            prompt,
            aspect_ratio: aspectRatioMap[aspectRatio],
            output_format: 'png',
            output_quality: 90,
            safety_tolerance: 2,
            ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Flux image generation timed out')), API_TIMEOUT_MS)
        ),
      ]),
    'generateImageFlux'
  );

  const duration = Date.now() - start;

  // Replicate returns a URL or a ReadableStream/FileOutput
  let imageBuffer: Buffer;

  if (typeof output === 'string') {
    // URL returned
    const response = await fetch(output);
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } else if (output && typeof output === 'object' && Symbol.asyncIterator in (output as object)) {
    // Async iterable (stream)
    const chunks: Uint8Array[] = [];
    for await (const chunk of output as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    imageBuffer = Buffer.concat(chunks);
  } else if (output instanceof ReadableStream) {
    const reader = output.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    imageBuffer = Buffer.concat(chunks);
  } else {
    throw new Error(`Unexpected Flux output type: ${typeof output}`);
  }

  fluxLogger.info(
    { duration, size: imageBuffer.length, estimatedCost: COST_ESTIMATES.flux },
    'Flux: image generation complete'
  );

  return imageBuffer;
}

// ─────────────────────────────────────────────────────────
// DALL-E 3 via OpenAI (Secondary / Fallback)
// ─────────────────────────────────────────────────────────

export async function generateImageDalle(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<Buffer> {
  const dalleLogger = logger.child({ fn: 'generateImageDalle' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const { aspectRatio = '1:1' } = options;

  const sizeMap: Record<AspectRatio, '1024x1024' | '1024x1792' | '1792x1024'> = {
    '1:1': '1024x1024',
    '9:16': '1024x1792',
    '16:9': '1792x1024',
    '4:5': '1024x1024', // DALL-E doesn't support 4:5 natively
  };

  dalleLogger.info(
    { prompt: prompt.slice(0, 100), aspectRatio, estimatedCost: COST_ESTIMATES.dalle3 },
    'DALL-E 3: starting image generation'
  );

  const start = Date.now();

  const response = await withRetry(
    () =>
      Promise.race([
        fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: sizeMap[aspectRatio],
            response_format: 'url',
            quality: 'hd',
          }),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DALL-E 3 image generation timed out')), API_TIMEOUT_MS)
        ),
      ]),
    'generateImageDalle'
  );

  if (!response.ok) {
    const errorData = (await response.json()) as { error?: { message?: string } };
    throw new Error(`DALL-E 3 API error: ${errorData.error?.message ?? response.statusText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ url?: string; b64_json?: string }>;
  };

  const imageUrl = data.data[0]?.url;
  if (!imageUrl) {
    throw new Error('DALL-E 3 returned no image URL');
  }

  const imgResponse = await fetch(imageUrl);
  const arrayBuffer = await imgResponse.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  const duration = Date.now() - start;
  dalleLogger.info(
    { duration, size: imageBuffer.length, estimatedCost: COST_ESTIMATES.dalle3 },
    'DALL-E 3: image generation complete'
  );

  return imageBuffer;
}

// ─────────────────────────────────────────────────────────
// Image Generator Orchestrator
// ─────────────────────────────────────────────────────────

export interface ImageOrchestrationInput {
  contentIdeaId: string;
  userId: string;
  visualDirection: string;
  styleProfile: StyleProfile | null;
  options?: ImageGenerationOptions;
  preferDalle?: boolean; // use DALL-E when text-in-image is needed
}

export async function orchestrateImageGeneration(
  input: ImageOrchestrationInput
): Promise<GeneratedImageResult> {
  const orchLogger = logger.child({
    fn: 'orchestrateImageGeneration',
    contentIdeaId: input.contentIdeaId,
    userId: input.userId,
  });

  const aspectRatio = input.options?.aspectRatio ?? '1:1';

  // Enhance the prompt with Claude
  const enhancedPrompt = await enhancePromptWithClaude(
    input.visualDirection,
    input.styleProfile,
    aspectRatio
  );

  orchLogger.info(
    { aspectRatio, preferDalle: input.preferDalle ?? false },
    'Image orchestrator: starting generation'
  );

  let imageBuffer: Buffer;
  let aiToolUsed: string;
  let estimatedCost: number;

  if (input.preferDalle && process.env.OPENAI_API_KEY) {
    try {
      imageBuffer = await generateImageDalle(enhancedPrompt, input.options);
      aiToolUsed = 'dalle3';
      estimatedCost = COST_ESTIMATES.dalle3;
    } catch (dalleError) {
      orchLogger.warn({ error: dalleError }, 'DALL-E 3 failed, falling back to Flux');
      imageBuffer = await generateImageFlux(enhancedPrompt, input.options);
      aiToolUsed = 'flux';
      estimatedCost = COST_ESTIMATES.flux;
    }
  } else {
    try {
      imageBuffer = await generateImageFlux(enhancedPrompt, input.options);
      aiToolUsed = 'flux';
      estimatedCost = COST_ESTIMATES.flux;
    } catch (fluxError) {
      orchLogger.warn({ error: fluxError }, 'Flux failed, falling back to DALL-E 3');
      if (!process.env.OPENAI_API_KEY) {
        throw fluxError;
      }
      imageBuffer = await generateImageDalle(enhancedPrompt, input.options);
      aiToolUsed = 'dalle3';
      estimatedCost = COST_ESTIMATES.dalle3;
    }
  }

  // Upload to R2
  const filename = `image-${Date.now()}.png`;
  const key = buildStoragePath(input.userId, input.contentIdeaId, filename);
  const storageUrl = await uploadFile(imageBuffer, key, 'image/png');

  orchLogger.info(
    { aiToolUsed, estimatedCost, storageUrl },
    'Image orchestrator: generation and upload complete'
  );

  return {
    buffer: imageBuffer,
    storageUrl,
    aiToolUsed,
    estimatedCost,
    promptUsed: enhancedPrompt,
  };
}
