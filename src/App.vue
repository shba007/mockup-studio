<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import MockupScene from './components/MockupScene.vue';
import TimelinePanel from './components/TimelinePanel.vue';

import defaultTemplate from '../templates/iphone-orbit.json';

const config = ref<Record<string, any>>(defaultTemplate);
const overrides = ref<Record<string, any>>({});
const isReady = ref(false);

const currentFrame = ref(0);
const isPlaying = ref(true);
const showTimeline = ref(false);

let animationFrameId: number | null = null;
let lastTimestamp = 0;

const durationFrames = computed(() => config.value?.output?.durationFrames || 120);
const fps = computed(() => config.value?.output?.fps || 60);

function seek(frame: number) {
  currentFrame.value = Math.max(0, Math.min(frame, durationFrames.value));
}

function togglePlay() {
  isPlaying.value = !isPlaying.value;
  lastTimestamp = 0;
}

function loop(timestamp: number) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (isPlaying.value) {
    currentFrame.value = (currentFrame.value + delta * fps.value) % durationFrames.value;
  }

  animationFrameId = requestAnimationFrame(loop);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 't') {
    showTimeline.value = !showTimeline.value;
  }
}

onMounted(() => {
  const globalPayload = (window as any).__RENDER_PAYLOAD__;
  if (globalPayload) {
    if (globalPayload.template) config.value = globalPayload.template;
    if (globalPayload.overrides) overrides.value = globalPayload.overrides;
  }

  (window as any).__SEEK_FRAME__ = (frame: number) => {
    isPlaying.value = false;
    seek(frame);
  };

  isReady.value = true;
  window.addEventListener('keydown', handleKeydown);
  animationFrameId = requestAnimationFrame(loop);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
});
</script>

<template>
  <div class="app-container">
    <Suspense>
      <MockupScene v-if="isReady" :config="config" :overrides="overrides" :current-frame="currentFrame" />
      <template #fallback>
        <div class="loading">Loading 3D Engine...</div>
      </template>
    </Suspense>

    <Transition name="fade">
      <TimelinePanel v-show="showTimeline && isReady" :current-frame="currentFrame" :duration-frames="durationFrames"
        :fps="fps" :is-playing="isPlaying" :config="config" @seek="seek" @toggle-play="togglePlay" />
    </Transition>
  </div>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.loading {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: ui-monospace, monospace;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 15px);
}
</style>
