import { db } from '@/db';
import {
  automationRules,
  automationLogs,
  contentIdeas,
  generatedContent,
} from '@/db/schema';
import type {
  AutomationRule,
  TriggerType,
  NewAutomationLog,
} from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ActionConfig {
  type: 'auto_approve' | 'auto_generate' | 'auto_publish' | 'send_notification';
  params?: Record<string, unknown>;
}

export interface RuleConditions {
  minViralityScore?: number;
  platforms?: string[];
  contentTypes?: string[];
}

export interface RuleEvaluationContext {
  topicId: string;
  userId: string;
  triggerType: TriggerType;
  trendIds?: string[];
  ideaIds?: string[];
  contentIds?: string[];
  viralityScore?: number;
  platform?: string;
  contentType?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsToExecute: ActionConfig[];
  reason?: string;
}

// ─────────────────────────────────────────────────────────
// Condition evaluation
// ─────────────────────────────────────────────────────────

function evaluateConditions(
  conditions: RuleConditions,
  context: RuleEvaluationContext
): { passed: boolean; reason?: string } {
  if (
    conditions.minViralityScore !== undefined &&
    context.viralityScore !== undefined &&
    context.viralityScore < conditions.minViralityScore
  ) {
    return {
      passed: false,
      reason: `Virality score ${context.viralityScore} below minimum ${conditions.minViralityScore}`,
    };
  }

  if (
    conditions.platforms &&
    conditions.platforms.length > 0 &&
    context.platform &&
    !conditions.platforms.includes(context.platform)
  ) {
    return {
      passed: false,
      reason: `Platform ${context.platform} not in allowed list`,
    };
  }

  if (
    conditions.contentTypes &&
    conditions.contentTypes.length > 0 &&
    context.contentType &&
    !conditions.contentTypes.includes(context.contentType)
  ) {
    return {
      passed: false,
      reason: `Content type ${context.contentType} not in allowed list`,
    };
  }

  return { passed: true };
}

// ─────────────────────────────────────────────────────────
// Log automation decision
// ─────────────────────────────────────────────────────────

async function logAutomationDecision(entry: NewAutomationLog): Promise<void> {
  try {
    await db.insert(automationLogs).values(entry);
  } catch (err) {
    logger.error({ err }, 'Failed to write automation log entry');
  }
}

// ─────────────────────────────────────────────────────────
// Evaluate all applicable rules for a context
// ─────────────────────────────────────────────────────────

export async function evaluateRules(
  context: RuleEvaluationContext
): Promise<RuleEvaluationResult[]> {
  const ruleLogger = logger.child({
    userId: context.userId,
    topicId: context.topicId,
    triggerType: context.triggerType,
  });

  // Load active rules for this user/topic + global rules (topicId IS NULL)
  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.userId, context.userId),
        eq(automationRules.isActive, true),
        eq(automationRules.triggerType, context.triggerType)
      )
    );

  // Filter to rules applicable to this topic (null topicId = all topics)
  const applicableRules = rules.filter(
    (r) => r.topicId === null || r.topicId === context.topicId
  );

  ruleLogger.info({ rulesFound: applicableRules.length }, 'Evaluating automation rules');

  const results: RuleEvaluationResult[] = [];

  for (const rule of applicableRules) {
    const conditions = rule.conditions as RuleConditions;
    const actions = rule.actions as ActionConfig[];

    const { passed, reason } = evaluateConditions(conditions, context);

    const result: RuleEvaluationResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: passed,
      actionsToExecute: passed ? actions : [],
      reason,
    };

    await logAutomationDecision({
      userId: context.userId,
      ruleId: rule.id,
      topicId: context.topicId,
      action: `evaluate_rule:${rule.name}`,
      status: passed ? 'success' : 'skipped',
      details: {
        triggerType: context.triggerType,
        conditionResult: { passed, reason },
        actionsScheduled: passed ? actions.map((a) => a.type) : [],
      },
    });

    ruleLogger.debug(
      { ruleId: rule.id, ruleName: rule.name, matched: passed, reason },
      'Rule evaluated'
    );

    results.push(result);
  }

  return results;
}

// ─────────────────────────────────────────────────────────
// Execute a specific action from a rule
// ─────────────────────────────────────────────────────────

export async function executeAction(
  action: ActionConfig,
  context: RuleEvaluationContext,
  ruleId: string,
  ruleName: string
): Promise<void> {
  const actionLogger = logger.child({
    userId: context.userId,
    topicId: context.topicId,
    ruleId,
    action: action.type,
  });

  actionLogger.info('Executing automation action');

  try {
    switch (action.type) {
      case 'auto_approve': {
        if (context.ideaIds && context.ideaIds.length > 0) {
          for (const ideaId of context.ideaIds) {
            await db
              .update(contentIdeas)
              .set({ status: 'approved', updatedAt: new Date() })
              .where(
                and(
                  eq(contentIdeas.id, ideaId),
                  eq(contentIdeas.userId, context.userId),
                  eq(contentIdeas.status, 'suggested')
                )
              );
          }
          actionLogger.info({ ideaCount: context.ideaIds.length }, 'Auto-approved ideas');
        }
        break;
      }

      case 'auto_generate': {
        // Enqueue content generation for approved ideas
        // This is handled by the pipeline orchestrator
        actionLogger.info('Auto-generate action flagged for pipeline');
        break;
      }

      case 'auto_publish': {
        if (context.contentIds && context.contentIds.length > 0) {
          for (const contentId of context.contentIds) {
            await db
              .update(generatedContent)
              .set({ status: 'approved', updatedAt: new Date() })
              .where(
                and(
                  eq(generatedContent.id, contentId),
                  eq(generatedContent.userId, context.userId)
                )
              );
          }
          actionLogger.info({ contentCount: context.contentIds.length }, 'Content marked for publish');
        }
        break;
      }

      case 'send_notification': {
        // Handled by caller (pipeline) which imports notification-service
        actionLogger.info('Notification action delegated to pipeline');
        break;
      }

      default: {
        actionLogger.warn({ actionType: (action as ActionConfig).type }, 'Unknown action type');
      }
    }

    await logAutomationDecision({
      userId: context.userId,
      ruleId,
      topicId: context.topicId,
      action: `execute:${action.type}`,
      status: 'success',
      details: { ruleName, params: action.params },
    });
  } catch (err) {
    actionLogger.error({ err }, 'Failed to execute automation action');
    await logAutomationDecision({
      userId: context.userId,
      ruleId,
      topicId: context.topicId,
      action: `execute:${action.type}`,
      status: 'failed',
      details: { ruleName, error: String(err) },
    });
  }
}
