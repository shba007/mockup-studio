<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Command } from '@tauri-apps/plugin-shell'
import { save } from '@tauri-apps/plugin-dialog'
import { mkdir, writeFile, remove } from '@tauri-apps/plugin-fs'
import { tempDir, join } from '@tauri-apps/api/path'

import MockupScene from './components/MockupScene.vue'
import TimelinePanel from './components/TimelinePanel.vue'
import { useAppUpdater } from './composables/useAppUpdater'

import templates from './templates'
import type { SceneAnimationConfig } from './utils/types.ts'

const { version } = useAppUpdater({ checkOnStartup: true, autoInstall: true })

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
let animationFrameId: number | null = null
let lastTimestamp = 0

const exportStatus = ref('Rendering Frames...')

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

  // 1. Prompt user for output .mp4 destination
  const defaultFileName = `${(config.value.id as string) || 'mockup'}.mp4`
  const outputPath = await save({
    defaultPath: defaultFileName,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  })

  if (!outputPath) return

  isExporting.value = true
  isPlaying.value = false
  exportProgress.value = 0
  exportStatus.value = 'Rendering frames...'

  const sysTemp = await tempDir()
  const timestampInSeconds = Math.floor(Date.now() / 1000)
  const sessionDir = await join(sysTemp, 'mockup-studio', String(timestampInSeconds))
  const tempFramesDir = await join(sessionDir, 'frames')
  await mkdir(tempFramesDir, { recursive: true })

  try {
    const totalFrames = durationFrames.value

    // 3. Render and save each frame directly to disk
    for (let i = 0; i <= totalFrames; i++) {
      seek(i)
      exportProgress.value = Math.round((i / totalFrames) * 80)
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (blob) {
        const buffer = await blob.arrayBuffer()
        const frameFileName = `frame_${String(i).padStart(4, '0')}.png`
        const frameFilePath = await join(tempFramesDir, frameFileName)
        await writeFile(frameFilePath, new Uint8Array(buffer))
      }
    }

    // 4. Encode video with FFmpeg Sidecar
    exportStatus.value = 'Encoding video with FFmpeg...'
    exportProgress.value = 85

    const inputPattern = await join(tempFramesDir, 'frame_%04d.png')

    const ffmpegArgs = [
      '-y',
      '-framerate',
      String(fps.value),
      '-i',
      inputPattern,
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '15',
      '-preset',
      'slow',
      outputPath,
    ]

    const ffmpegCommand = Command.sidecar('bin/ffmpeg', ffmpegArgs)

    ffmpegCommand.on('close', (data) => {
      console.log(`FFmpeg process finished with code ${data.code}`)
    })

    ffmpegCommand.stderr.on('data', (line) => {
      console.log(`[FFmpeg]: ${line}`)
    })

    const result = await ffmpegCommand.execute()

    if (result.code !== 0) {
      throw new Error(`FFmpeg failed with exit code ${result.code}: ${result.stderr}`)
    }

    exportProgress.value = 100
    exportStatus.value = 'Done!'
  } catch (error) {
    console.error('Render pipeline error:', error)
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    // 5. Clean up the session directory
    try {
      await remove(sessionDir, { recursive: true })
    } catch (cleanupErr) {
      console.warn('Failed to remove temp directory:', cleanupErr)
    }

    setTimeout(() => {
      isExporting.value = false
    }, 800)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 't') {
    showTimeline.value = !showTimeline.value
  }
}

onMounted(() => {
  console.log('App Version', version.value)

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
          v-for="key in Object.keys(templates)"
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
      <h2 class="text-base font-medium tracking-wide">{{ exportStatus }}</h2>
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