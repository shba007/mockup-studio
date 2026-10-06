import { ref, computed, onMounted, onUnmounted, type ComputedRef } from 'vue'

export function useViewportScale(
  width: ComputedRef<number>,
  height: ComputedRef<number>,
  padding = 0.88,
) {
  const scale = ref(1)

  function update() {
    if (typeof window === 'undefined') return
    const scaleX = (window.innerWidth * padding) / width.value
    const scaleY = (window.innerHeight * padding) / height.value
    scale.value = Math.min(scaleX, scaleY)
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  const containerStyle = computed(() => ({
    width: `${width.value}px`,
    height: `${height.value}px`,
    transform: `translate(-50%, -50%) scale(${scale.value})`,
  }))

  return { scale, containerStyle, update }
}