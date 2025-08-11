export function calculateScore(passed: number) {
  return Math.max(0, Math.floor(passed));
}
