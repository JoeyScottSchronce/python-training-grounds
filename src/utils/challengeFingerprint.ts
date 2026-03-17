import { Challenge } from '../types';

export function makeTopicDifficultyKey(topicId: string, difficulty: string): string {
  return `${topicId}:${difficulty}`;
}

export function fingerprintChallenge(challenge: Challenge): string {
  // Simple deterministic fingerprint
  return btoa(challenge.description + challenge.context).slice(0, 32);
}
