<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import JSZip from 'jszip'
import MockupScene from './components/MockupScene.vue'
import TimelinePanel from './components/TimelinePanel.vue'
import { useAppUpdater } from './composables/useAppUpdater'

import multiIphoneFanout from './templates/multi-iphone-fanout.json'
import macbookPlatformReveal from './templates/macbook-platform-reveal.json'
import iphoneHelixShowcase from './templates/iphone-helix-showcase.json'

const { version } = useAppUpdater({ checkOnStartup: true, autoInstall: true })

const templateLibrary: Record<string, unknown> = {
  'Multi iPhone Fanout': multiIphoneFanout,
  'MacBook Platform Reveal': macbookPlatformReveal,
  'iPhone Helix Showcase': iphoneHelixShowcase,
}

const selectedTemplateKey = ref('Multi iPhone Fanout')
const config = ref<Record<string, unknown>>(templateLibrary[selectedTemplateKey.value])
const overrides = ref<Record<string, unknown>>({})
const isReady = ref(false)
const currentFrame = ref(0)
const isPlaying = ref(true)
const showTimeline = ref(false)
const isExporting = ref(false)
const exportProgress = ref(0)
let animationFrameId: number | null = null
let lastTimestamp = 0

const durationFrames = computed(() => config.value?.output?.durationFrames || 120)
const fps = computed(() => config.value?.output?.fps || 60)

function handleTemplateChange() {
  config.value = templateLibrary[selectedTemplateKey.value]
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
  const zip = new JSZip()
  const folder = zip.folder('frames')

  for (let i = 0; i <= durationFrames.value; i++) {
    seek(i)
    exportProgress.value = Math.round((i / durationFrames.value) * 100)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (blob && folder) {
      const fileName = `frame_${String(i).padStart(4, '0')}.png`
      folder.file(fileName, blob)
    }
  }

  exportProgress.value = 100
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const downloadUrl = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = `${config.value.id || 'export'}-frames.zip`
  a.click()
  URL.revokeObjectURL(downloadUrl)
  isExporting.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 't') {
    showTimeline.value = !showTimeline.value
  }
}

onMounted(() => {
  console.log('App Version', version)

  const globalPayload = (window as unknown as { __RENDER_PAYLOAD__?: Record<string, unknown> })
    .__RENDER_PAYLOAD__
  if (globalPayload) {
    if (globalPayload.template) config.value = globalPayload.template
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
    <!-- Template Selector -->
    <div v-if="!isExporting && isReady" class="absolute top-6 left-6 z-50">
      <select
        v-model="selectedTemplateKey"
        @change="handleTemplateChange"
        class="cursor-pointer appearance-none rounded-lg border border-white/10 bg-[#121218]/85 px-4 py-2.5 font-mono text-[13px] text-slate-200 shadow-2xl backdrop-blur-md outline-none transition-colors hover:border-white/25 focus:border-indigo-500/50"
      >
        <option
          v-for="key in Object.keys(templateLibrary)"
          :key="key"
          :value="key"
          class="bg-[#121218] text-slate-200"
        >
          {{ key }}
        </option>
      </select>
    </div>

    <!-- Export Overlay -->
    <div
      v-if="isExporting"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 font-mono text-white backdrop-blur-md"
    >
      <div
        class="mb-6 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-indigo-500"
      ></div>
      <h2 class="text-base font-medium tracking-wide">Rendering Frame Sequence...</h2>
      <div class="my-4 h-2 w-[300px] overflow-hidden rounded-full bg-[#333]">
        <div
          class="h-full bg-indigo-500 transition-[width] duration-100 ease-linear"
          :style="{ width: `${exportProgress}%` }"
        ></div>
      </div>
      <p class="text-sm text-zinc-400">{{ exportProgress }}% Complete</p>
    </div>

    <!-- 3D Scene Viewport -->
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

    <!-- Timeline Panel -->
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
        :current-frame="currentFrame"
        :duration-frames="durationFrames"
        :fps="fps"
        :is-playing="isPlaying"
        :config="config"
        @seek="seek"
        @toggle-play="togglePlay"
        @export-sequence="exportSequence"
      />
    </Transition>
  </div>
</template>