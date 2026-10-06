<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Output, BufferTarget, Mp4OutputFormat, CanvasSource } from 'mediabunny'
import { useScreenSafeArea } from '@vueuse/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

import MockupScene from './components/MockupScene.vue'
import StageRenderer2D from './components/StageRenderer2D.vue'
import TimelinePanel from './components/TimelinePanel.vue'
import EditorPanel from './components/EditorPanel.vue'

import templates from './templates'
import type { SceneAnimationConfig, Project2DConfig, Project3DConfig } from './utils/types'

const { top, right, bottom, left } = useScreenSafeArea()

const selectedTemplateKey = ref('Terminal Question Card (2D)')
const config = ref<SceneAnimationConfig>(
  templates[selectedTemplateKey.value] as SceneAnimationConfig,
)
const overrides = ref<Record<string, unknown>>({})
const isReady = ref(false)
const currentFrame = ref(0)
const isPlaying = ref(false)
const showTimeline = ref(false)
const showEditor = ref(true)
const isExporting = ref(false)
const exportProgress = ref(0)
const exportStatus = ref('Processing...')

let animationFrameId: number | null = null
let lastTimestamp = 0

const is2D = computed(() => config.value.kind === '2d')
const isStatic = computed(() => config.value.mode === 'static')

const durationFrames = computed(() => config.value.output.durationFrames ?? 120)
const fps = computed(() => config.value.output.fps ?? 60)

function handleTemplateChange() {
  config.value = templates[selectedTemplateKey.value] as SceneAnimationConfig
  overrides.value = {}
  currentFrame.value = 0
  isPlaying.value = !isStatic.value
}

function handleOverride(key: string, val: unknown) {
  overrides.value = { ...overrides.value, [key]: val }
}

function seek(frame: number) {
  currentFrame.value = Math.max(0, Math.min(frame, durationFrames.value))
}

function togglePlay() {
  if (isExporting.value || isStatic.value) return
  isPlaying.value = !isPlaying.value
  lastTimestamp = 0
}

function loop(timestamp: number) {
  if (!lastTimestamp) lastTimestamp = timestamp
  const delta = (timestamp - lastTimestamp) / 1000
  lastTimestamp = timestamp

  if (isPlaying.value && !isExporting.value && !isStatic.value) {
    currentFrame.value = (currentFrame.value + delta * fps.value) % durationFrames.value
  }

  animationFrameId = requestAnimationFrame(loop)
}

async function saveExportFile(
  fileName: string,
  data: Uint8Array,
  mimeType: string,
  filterName: string,
  ext: string,
) {
  if ('__TAURI_INTERNALS__' in window) {
    try {
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: filterName, extensions: [ext] }],
      })
      if (filePath) await writeFile(filePath, data)
    } catch {
      alert('Failed to save file.')
    }
  } else {
    const blob = new Blob([data as unknown as BlobPart], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
}

async function exportStaticImage() {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement
  if (!canvas) return

  canvas.toBlob(async (blob) => {
    if (!blob) return
    const buffer = new Uint8Array(await blob.arrayBuffer())
    await saveExportFile(`${config.value.id}.png`, buffer, 'image/png', 'PNG Image', 'png')
  }, 'image/png')
}

async function exportVideoSequence() {
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
  await saveExportFile(
    `${config.value.id}.mp4`,
    new Uint8Array(target.buffer!),
    'video/mp4',
    'MP4 Video',
    'mp4',
  )

  exportProgress.value = 100
  setTimeout(() => {
    isExporting.value = false
  }, 800)
}

function handleExport() {
  if (isStatic.value) {
    exportStaticImage()
  } else {
    exportVideoSequence()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 't' && !isStatic.value) {
    showTimeline.value = !showTimeline.value
  }
}

onMounted(() => {
  isReady.value = true
  isPlaying.value = !isStatic.value
  window.addEventListener('keydown', handleKeydown)
  animationFrameId = requestAnimationFrame(loop)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <div
    class="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0d0e15] font-sans"
  >
    <header
      v-if="!isExporting && isReady"
      class="absolute z-50 flex items-center justify-between pointer-events-none"
      :style="{
        top: `calc(1rem + ${top})`,
        left: `calc(1.25rem + ${left})`,
        right: `calc(1.25rem + ${right})`,
      }"
    >
      <div class="pointer-events-auto"></div>

      <div class="pointer-events-auto flex items-center gap-2">
        <select
          v-model="selectedTemplateKey"
          @change="handleTemplateChange"
          class="cursor-pointer rounded-full border border-white/10 bg-[#1c1d27]/90 px-4 py-1.5 font-sans text-xs font-medium text-zinc-200 shadow-xl backdrop-blur-md outline-none transition hover:border-white/20"
        >
          <option
            v-for="key in Object.keys(templates)"
            :key="key"
            :value="key"
            class="bg-[#1c1d27] text-zinc-200"
          >
            {{ key }}
          </option>
        </select>

        <button
          type="button"
          class="cursor-pointer rounded-full border border-white/10 bg-[#1c1d27]/90 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 shadow-xl backdrop-blur-md transition hover:border-white/20 active:scale-95"
          @click="showEditor = !showEditor"
        >
          {{ showEditor ? '✕ Hide Controls' : '🎨 Studio' }}
        </button>
      </div>
    </header>

    <div
      v-if="isExporting"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 font-sans text-white backdrop-blur-md"
    >
      <div class="mb-6 size-10 animate-spin rounded-full border-4 border-white/10 border-t-white" />
      <h2 class="text-base font-medium tracking-wide">{{ exportStatus }}</h2>
      <div class="my-4 h-2 w-[300px] overflow-hidden rounded-full bg-zinc-800">
        <div
          class="h-full bg-white transition-[width] duration-100 ease-linear"
          :style="{ width: `${exportProgress}%` }"
        />
      </div>
      <p class="text-sm text-zinc-400">{{ exportProgress }}% Complete</p>
    </div>

    <StageRenderer2D
      v-if="isReady && is2D"
      :key="`2d-${config.id}`"
      :config="config as Project2DConfig"
      :overrides="overrides"
      :current-frame="currentFrame"
    />

    <Suspense v-else-if="isReady">
      <MockupScene
        :key="`3d-${config.id}`"
        :config="config as Project3DConfig"
        :overrides="overrides"
        :current-frame="currentFrame"
      />
      <template #fallback>
        <div class="flex h-screen items-center justify-center font-sans text-white">
          Loading 3D Engine...
        </div>
      </template>
    </Suspense>

    <EditorPanel
      v-if="showEditor && isReady && !isExporting"
      :config="config"
      :overrides="overrides"
      @update-override="handleOverride"
      @close="showEditor = false"
    />

    <footer
      v-if="!isExporting && isReady"
      class="absolute z-40 flex items-center justify-between rounded-full border border-white/10 bg-[#161720]/80 px-4 py-2 font-sans text-xs text-zinc-300 shadow-2xl backdrop-blur-xl"
      :style="{ bottom: `calc(1.25rem + ${bottom})`, width: 'min(92vw, 840px)' }"
    >
      <div class="flex items-center gap-2 truncate">
        <span class="font-semibold text-white">{{ config.name || config.id }}</span>
        <span class="text-zinc-500">·</span>
        <span class="text-zinc-400 uppercase tracking-wider text-[10px]"
          >{{ config.kind }} {{ config.mode }}</span
        >
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="!isStatic"
          type="button"
          class="cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-white transition hover:bg-white/20 active:scale-95"
          @click="showTimeline = !showTimeline"
        >
          {{ showTimeline ? '✕ Timeline' : '⏱ Timeline' }}
        </button>

        <button
          type="button"
          class="cursor-pointer rounded-full bg-white px-4 py-1.5 font-bold text-zinc-950 shadow transition hover:bg-zinc-200 active:scale-95"
          @click="handleExport"
        >
          {{ isStatic ? 'Export' : 'Render Video' }}
        </button>
      </div>
    </footer>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <TimelinePanel
        v-show="showTimeline && isReady && !isExporting && !isStatic"
        :style="{ bottom: `calc(5rem + ${bottom})` }"
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