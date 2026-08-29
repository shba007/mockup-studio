<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentFrame: number
  durationFrames: number
  fps: number
  isPlaying: boolean
  config: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'update:currentFrame', frame: number): void
  (e: 'togglePlay'): void
  (e: 'seek', frame: number): void
  (e: 'exportSequence'): void
}>()

const tracks = computed(() => {
  const camera = props.config.camera?.keyframes || {}
  const trackList: { name: string; frames: number[] }[] = []
  const devices = props.config.devices || (props.config.device ? [props.config.device] : [])

  devices.forEach((dev, index: number) => {
    const name = dev.name || `Device ${index + 1}`
    const kf = dev.keyframes || {}

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
    class="absolute bottom-6 left-1/2 z-50 w-[92vw] max-w-[900px] -translate-x-1/2 select-none rounded-xl border border-white/10 bg-[#121218]/85 px-5 py-4 font-mono text-slate-200 shadow-2xl backdrop-blur-md"
  >
    <!-- Controls Header -->
    <div class="mb-3.5 flex items-center justify-between">
      <!-- Buttons -->
      <div class="flex items-center gap-2">
        <button
          class="cursor-pointer rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 active:scale-95"
          @click="emit('togglePlay')"
        >
          {{ isPlaying ? '⏸ Pause' : '▶ Play' }}
        </button>

        <button
          class="cursor-pointer rounded-md bg-white/[0.08] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.15] active:scale-95"
          @click="emit('seek', 0)"
        >
          ⏮ Reset
        </button>

        <button
          class="cursor-pointer rounded-md bg-yellow-500 px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-yellow-400 active:scale-95"
          @click="emit('exportSequence')"
        >
          📷 Export PNG Sequence
        </button>
      </div>

      <!-- Time Display -->
      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span class="font-bold text-sky-400">F: {{ Math.floor(currentFrame) }}</span>
        <span>/ {{ durationFrames }}</span>
        <span class="text-slate-600">|</span>
        <span>{{ currentTimeSec }}s / {{ totalTimeSec }}s</span>
        <span class="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px]">{{ fps }} FPS</span>
      </div>
    </div>

    <!-- Tracks & Scrubber -->
    <div class="relative flex cursor-pointer flex-col gap-2 py-2" @click="handleTimelineClick">
      <!-- Playhead -->
      <div
        class="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2"
        :style="{ left: `${progressPercent}%` }"
      >
        <div class="h-full w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
      </div>

      <!-- Keyframe Tracks -->
      <div v-for="track in tracks" :key="track.name" class="flex h-5 items-center gap-3">
        <span class="w-32 truncate text-[11px] text-slate-500">
          {{ track.name }}
        </span>

        <div class="relative h-1 flex-1 rounded-full bg-white/[0.08]">
          <div
            v-for="frame in track.frames"
            :key="frame"
            class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-pointer rounded-[1px] border border-slate-900 bg-sky-400 transition-all duration-150 hover:scale-125 hover:bg-yellow-400"
            :style="{ left: `${(frame / durationFrames) * 100}%` }"
            :title="`Frame ${frame}`"
            @click.stop="emit('seek', frame)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>