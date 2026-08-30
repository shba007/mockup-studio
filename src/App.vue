<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Output, BufferTarget, Mp4OutputFormat, CanvasSource } from 'mediabunny'
import { useScreenSafeArea } from '@vueuse/core'

import MockupScene from './components/MockupScene.vue'
import TimelinePanel from './components/TimelinePanel.vue'
import { useAppUpdater } from './composables/useAppUpdater'

import templates from './templates'
import type { SceneAnimationConfig } from './utils/types'

const { version } = useAppUpdater({ checkOnStartup: true, autoInstall: true })
const { top, right, bottom, left } = useScreenSafeArea()

const selectedTemplateKey = ref('Macbook Podium Showcase')
const config = ref<SceneAnimationConfig>(
  templates[selectedTemplateKey.value] as SceneAnimationConfig,
)
const overrides = ref<Record<string, unknown>>({})
const isReady = ref(false)
const currentFrame = ref(0)
const isPlaying = ref(true)
const showTimeline = ref(false)
const isExporting = ref(false)
const exportProgress = ref(0)
const exportStatus = ref('Rendering Frames...')

let animationFrameId: number | null = null
let lastTimestamp = 0

const durationFrames = computed(() => config.value?.output?.durationFrames || 120)
const fps = computed(() => config.value?.output?.fps || 60)

function handleTemplateChange() {
  config.value = templates[selectedTemplateKey.value] as SceneAnimationConfig
  currentFrame.value = 0
}

function seek(frame: number) {
  currentFrame.value = Math.max(0, Math.min(frame, durationFrames.value))
}

function togglePlay() {
  if (isExporting.value) return
  isPlaying.value = !isPlaying.value
  lastTimestamp = 0
}

function loop(timestamp: number) {
  if (!lastTimestamp) lastTimestamp = timestamp
  const delta = (timestamp - lastTimestamp) / 1000
  lastTimestamp = timestamp

  if (isPlaying.value && !isExporting.value) {
    currentFrame.value = (currentFrame.value + delta * fps.value) % durationFrames.value
  }

  animationFrameId = requestAnimationFrame(loop)
}

async function exportSequence() {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement
  if (!canvas) return

  isExporting.value = true
  isPlaying.value = false
  exportProgress.value = 0
  exportStatus.value = 'Encoding video...'

  const target = new BufferTarget()
  const output = new Output({
    target,
    format: new Mp4OutputFormat({
      fastStart: 'in-memory',
    }),
  })

  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: 8_000_000,
  })

  output.addVideoTrack(videoSource)
  await output.start()

  const totalFrames = durationFrames.value

  for (let i = 0; i <= totalFrames; i++) {
    seek(i)
    exportProgress.value = Math.round((i / totalFrames) * 95)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await videoSource.add(i / fps.value, 1 / fps.value)
  }

  await output.finalize()

  const mp4Blob = new Blob([target.buffer!], { type: 'video/mp4' })
  const url = URL.createObjectURL(mp4Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.value.id || 'mockup'}.mp4`
  a.click()
  URL.revokeObjectURL(url)

  exportProgress.value = 100
  setTimeout(() => {
    isExporting.value = false
  }, 800)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 't') {
    showTimeline.value = !showTimeline.value
  }
}

onMounted(() => {
  const globalPayload = (window as unknown as { __RENDER_PAYLOAD__?: Record<string, unknown> })
    .__RENDER_PAYLOAD__
  if (globalPayload) {
    if (globalPayload.template) config.value = globalPayload.template as SceneAnimationConfig
    if (globalPayload.overrides) overrides.value = globalPayload.overrides
  }

  isReady.value = true
  window.addEventListener('keydown', handleKeydown)
  animationFrameId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <div class="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
    <div
      v-if="!isExporting && isReady"
      class="absolute z-50 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 pointer-events-none"
      :style="{
        top: `calc(0.25rem + ${top})`,
        left: `calc(0.25rem + ${left})`,
        right: `calc(1rem + ${right})`,
      }"
    >
      <div class="pointer-events-auto w-full sm:w-auto flex justify-center sm:justify-start">
        <select
          v-model="selectedTemplateKey"
          @change="handleTemplateChange"
          class="cursor-pointer appearance-none rounded-lg border border-white/10 bg-[#121218]/85 px-4 py-2 font-mono text-[13px] text-slate-200 shadow-2xl backdrop-blur-md outline-none transition-colors hover:border-white/25 focus:border-indigo-500/50 max-w-[250px] truncate"
        >
          <option
            v-for="key in Object.keys(templates)"
            :key="key"
            :value="key"
            class="bg-[#121218] text-slate-200"
          >
            {{ key }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2 pointer-events-auto">
        <button
          class="cursor-pointer rounded-lg border border-white/10 bg-[#121218]/85 px-3 py-2 font-mono text-[13px] text-slate-200 shadow-2xl backdrop-blur-md transition-colors hover:border-white/25 active:scale-95"
          @click="showTimeline = !showTimeline"
        >
          {{ showTimeline ? '✕ Hide Timeline' : '⏱ Timeline' }}
        </button>

        <button
          class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 font-mono text-[13px] font-semibold text-white shadow-2xl transition-colors hover:bg-indigo-500 active:scale-95"
          @click="exportSequence"
        >
          📷 Export Video
        </button>
      </div>
    </div>

    <div
      v-if="isExporting"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 font-mono text-white backdrop-blur-md"
    >
      <div
        class="mb-6 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-indigo-500"
      ></div>
      <h2 class="text-base font-medium tracking-wide">{{ exportStatus }}</h2>
      <div class="my-4 h-2 w-[300px] overflow-hidden rounded-full bg-[#333]">
        <div
          class="h-full bg-indigo-500 transition-[width] duration-100 ease-linear"
          :style="{ width: `${exportProgress}%` }"
        ></div>
      </div>
      <p class="text-sm text-zinc-400">{{ exportProgress }}% Complete</p>
    </div>

    <Suspense>
      <MockupScene
        v-if="isReady"
        :key="config.id"
        :config="config"
        :overrides="overrides"
        :current-frame="currentFrame"
      />
      <template #fallback>
        <div class="flex h-screen items-center justify-center font-mono text-white">
          Loading 3D Engine...
        </div>
      </template>
    </Suspense>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <TimelinePanel
        v-show="showTimeline && isReady && !isExporting"
        :style="{ bottom: `calc(1.5rem + ${bottom})` }"
        :current-frame="currentFrame"
        :duration-frames="durationFrames"
        :fps="fps"
        :is-playing="isPlaying"
        :config="config"
        @seek="seek"
        @toggle-play="togglePlay"
      />
    </Transition>
  </div>
</template>