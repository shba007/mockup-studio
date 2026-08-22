export interface Keyframe {
  frame: number;
  value: number[];
}

export function evaluateKeyframes(keyframes: Keyframe[], currentFrame: number): number[] {
  if (!keyframes || keyframes.length === 0) return [0, 0, 0];
  if (keyframes.length === 1 || currentFrame <= keyframes[0].frame) {
    return [...keyframes[0].value];
  }

  const last = keyframes[keyframes.length - 1];
  if (currentFrame >= last.frame) {
    return [...last.value];
  }

  // Find surrounding frames
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];

    if (currentFrame >= k1.frame && currentFrame <= k2.frame) {
      const progress = (currentFrame - k1.frame) / (k2.frame - k1.frame);
      return k1.value.map((v, idx) => v + (k2.value[idx] - v) * progress);
    }
  }

  return [...keyframes[0].value];
}
