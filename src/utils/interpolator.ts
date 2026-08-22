export interface Keyframe {
  frame: number
  value: number[]
  easing?:
    | 'linear'
    | 'easeOutCubic'
    | 'easeInCubic'
    | 'easeInOutCubic'
    | 'easeOutQuad'
    | 'easeInOutQuad'
    | 'easeOutExpo'
}

const EASING_FUNCTIONS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
}

export function evaluateKeyframes(keyframes: Keyframe[], currentFrame: number): number[] {
  if (!keyframes || keyframes.length === 0) return [0, 0, 0]

  const first = keyframes[0]
  if (!first) return [0, 0, 0]

  if (keyframes.length === 1 || currentFrame <= first.frame) {
    return [...first.value]
  }

  const last = keyframes[keyframes.length - 1]
  if (!last) return [0, 0, 0]

  if (currentFrame >= last.frame) {
    return [...last.value]
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i]
    const k2 = keyframes[i + 1]

    // Ensure both keyframes actually exist in the array
    if (!k1 || !k2) continue

    if (currentFrame >= k1.frame && currentFrame <= k2.frame) {
      const rawProgress = (currentFrame - k1.frame) / (k2.frame - k1.frame)
      const easingName = k1.easing || 'linear'

      // Ensure easeFn is safely accessed
      const easeFn = EASING_FUNCTIONS[easingName] ?? EASING_FUNCTIONS.linear
      const progress = easeFn!(rawProgress)

      return k1.value.map((v: number, idx: number) => {
        // Fallback to current value if k2 doesn't have a matching index
        const targetV = k2.value[idx] ?? v
        return v + (targetV - v) * progress
      })
    }
  }

  return [...first.value]
}
