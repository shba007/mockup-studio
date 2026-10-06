<script setup lang="ts">
import { computed } from 'vue'
import type { SceneAnimationConfig } from '../utils/types'

const props = defineProps<{
  currentFrame: number
  durationFrames: number
  fps: number
  isPlaying: boolean
  config: SceneAnimationConfig
}>()

const emit = defineEmits<{
  (e: 'togglePlay'): void
  (e: 'seek', frame: number): void
}>()

const tracks = computed(() => {
  const camera = props.config.camera?.keyframes || {}
  const trackList: { name: string; frames: number[] }[] = []
  const objects = props.config.objects || []

  objects.forEach((obj, index: number) => {
    const name = obj.name || `Object ${index + 1}`
    const kf = obj.keyframes || {}

    if (kf.position) {
      trackList.push({ name: `${name} Pos`, frames: kf.position.map((k) => k.frame) })
    }
    if (kf.rotation) {
      trackList.push({ name: `${name} Rot`, frames: kf.rotation.map((k) => k.frame) })
    }
  })

  if (camera.position) {
    trackList.push({
      name: 'Camera Position',
      frames: camera.position.map((k) => k.frame),
    })
  }

  return trackList
})

const progressPercent = computed(() => (props.currentFrame / props.durationFrames) * 100)
const currentTimeSec = computed(() => (props.currentFrame / props.fps).toFixed(2))
const totalTimeSec = computed(() => (props.durationFrames / props.fps).toFixed(2))

function handleTimelineClick(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const clickX = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
  const targetFrame = Math.round((clickX / rect.width) * props.durationFrames)
  emit('seek', targetFrame)
}
</script>

<template>
  <div
    class="absolute left-1/2 z-50 w-[92vw] max-w-[840px] -translate-x-1/2 select-none rounded-[24px] border border-white/10 bg-[#161720]/95 px-5 py-4 font-sans text-slate-200 shadow-2xl backdrop-blur-2xl"
  >
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-full bg-white px-3.5 py-1 text-xs font-bold text-zinc-950 shadow transition hover:bg-zinc-200 active:scale-95"
          @click="emit('togglePlay')"
        >
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>

        <button
          type="button"
          class="cursor-pointer rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95"
          @click="emit('seek', 0)"
        >
          Reset
        </button>

        <div
          class="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-zinc-300"
        >
          <span>{{ currentTimeSec }}s</span>
          <span class="text-zinc-600">/</span>
          <span class="text-zinc-500">{{ totalTimeSec }}s</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span
          class="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] text-zinc-300"
        >
          F: {{ Math.floor(currentFrame) }} / {{ durationFrames }}
        </span>
        <span
          class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400"
        >
          {{ fps }} FPS
        </span>
      </div>
    </div>

    <div class="relative flex cursor-pointer flex-col gap-2.5 py-1.5" @click="handleTimelineClick">
      <div
        class="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2"
        :style="{ left: `${progressPercent}%` }"
      >
        <div class="h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        <div
          class="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border border-white bg-white shadow"
        />
      </div>

      <div v-for="track in tracks" :key="track.name" class="flex h-4 items-center gap-3">
        <span class="w-28 truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {{ track.name }}
        </span>

        <div class="relative h-2 flex-1 rounded-full border border-white/5 bg-white/[0.04]">
          <div
            v-for="frame in track.frames"
            :key="frame"
            class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white bg-[#161720] shadow-sm transition-transform hover:scale-125"
            :style="{ left: `${(frame / durationFrames) * 100}%` }"
            :title="`Frame ${frame}`"
            @click.stop="emit('seek', frame)"
          />
        </div>
      </div>
    </div>
  </div>
</template>