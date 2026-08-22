<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import JSZip from 'jszip'
import MockupScene from './components/MockupScene.vue'
import TimelinePanel from './components/TimelinePanel.vue'
import defaultTemplate from '../templates/iphone-orbit.json'

const config = ref<Record<string, unknown>>(defaultTemplate)
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
  a.download = `${config.value.id}-frames.zip`
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
  <div class="app-container">
    <div v-if="isExporting" class="export-overlay">
      <div class="spinner"></div>
      <h2>Rendering Frame Sequence...</h2>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" :style="{ width: `${exportProgress}%` }"></div>
      </div>
      <p>{{ exportProgress }}% Complete</p>
    </div>

    <Suspense>
      <MockupScene
        v-if="isReady"
        :config="config"
        :overrides="overrides"
        :current-frame="currentFrame"
      />
      <template #fallback>
        <div class="loading">Loading 3D Engine...</div>
      </template>
    </Suspense>

    <Transition name="fade">
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

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  position: relative;
}

.loading {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: ui-monospace, monospace;
}

.export-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: ui-monospace, monospace;
}

.progress-bar-bg {
  width: 300px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  margin: 16px 0;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #6366f1;
  transition: width 0.1s linear;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 15px);
}
</style>
