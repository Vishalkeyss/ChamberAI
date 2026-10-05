import type { PlatformChamber, ChamberSetupProgress, ChamberSetupStep } from '../types';

/**
 * Calculates dynamic setup progress for a chamber.
 * If the backend API provided setupProgress directly from D1, it uses it.
 * Otherwise, dynamically computes the steps based on chamber attributes.
 */
export function getChamberSetupProgress(chamber: PlatformChamber | null | undefined): ChamberSetupProgress {
  if (!chamber) {
    return {
      percent: 0,
      completedSteps: 0,
      totalSteps: 7,
      steps: [
        { key: 'plan', label: 'Set up a membership plan', done: false },
        { key: 'gateway', label: 'Connect a payment gateway', done: false },
        { key: 'branding', label: 'Add your logo & brand colors', done: false },
        { key: 'members', label: 'Add or invite your first members', done: false },
        { key: 'event', label: 'Create your first event', done: false },
        { key: 'engagement', label: 'Set up a newsletter or alert workflow', done: false },
        { key: 'jobs', label: 'Post to the Job Board', done: false },
      ],
    };
  }

  if (chamber.setupProgress && Array.isArray(chamber.setupProgress.steps) && chamber.setupProgress.steps.length > 0) {
    return chamber.setupProgress;
  }

  const isOnboarded = Boolean(chamber.onboarded);
  const membersCount = chamber.membersCount || 0;

  const steps: ChamberSetupStep[] = [
    { key: 'plan', label: 'Set up a membership plan', done: isOnboarded },
    { key: 'gateway', label: 'Connect a payment gateway', done: isOnboarded },
    { key: 'branding', label: 'Add your logo & brand colors', done: isOnboarded },
    { key: 'members', label: 'Add or invite your first members', done: membersCount > 0 },
    { key: 'event', label: 'Create your first event', done: membersCount > 400 },
    { key: 'engagement', label: 'Set up a newsletter or alert workflow', done: membersCount > 1000 },
    { key: 'jobs', label: 'Post to the Job Board', done: membersCount > 1000 },
  ];

  const completedSteps = steps.filter((s) => s.done).length;
  const percent = Math.round((completedSteps / steps.length) * 100);

  return {
    percent,
    completedSteps,
    totalSteps: steps.length,
    steps,
  };
}
