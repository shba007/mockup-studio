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
  const trackList = []
  const devices = props.config.devices || (props.config.device ? [props.config.device] : [])

  devices.forEach((dev: unknown, index: number) => {
    const name = dev.name || `Device ${index + 1}`
    const kf = dev.keyframes || {}

    if (kf.position) {
      trackList.push({ name: `${name} Pos`, frames: kf.position.map((k: unknown) => k.frame) })
    }
    if (kf.rotation) {
      trackList.push({ name: `${name} Rot`, frames: kf.rotation.map((k: unknown) => k.frame) })
    }
  })

  if (camera.position) {
    trackList.push({
      name: 'Camera Position',
      frames: camera.position.map((k: unknown) => k.frame),
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
  <div class="timeline-container">
    <div class="controls-row">
      <div class="btn-group">
        <button class="control-btn" @click="emit('togglePlay')">
          {{ isPlaying ? '⏸ Pause' : '▶ Play' }}
        </button>
        <button class="control-btn secondary" @click="emit('seek', 0)">⏮ Reset</button>
        <button
          class="control-btn"
          style="background: #eab308; color: black"
          @click="emit('exportSequence')"
        >
          📷 Export PNG Sequence
        </button>
      </div>

      <div class="time-display">
        <span class="highlight">F: {{ Math.floor(currentFrame) }}</span> / {{ durationFrames }}
        <span class="divider">|</span>
        <span>{{ currentTimeSec }}s / {{ totalTimeSec }}s</span>
        <span class="fps-badge">{{ fps }} FPS</span>
      </div>
    </div>

    <div class="tracks-wrapper" @click="handleTimelineClick">
      <div class="playhead" :style="{ left: `${progressPercent}%` }">
        <div class="playhead-line"></div>
      </div>

      <div v-for="track in tracks" :key="track.name" class="track-row">
        <span class="track-label">{{ track.name }}</span>
        <div class="track-timeline">
          <div
            v-for="frame in track.frames"
            :key="frame"
            class="keyframe-diamond"
            :style="{ left: `${(frame / durationFrames) * 100}%` }"
            :title="`Frame ${frame}`"
            @click.stop="emit('seek', frame)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: min(900px, 92vw);
  background: rgba(18, 18, 24, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px 20px;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  user-select: none;
  z-index: 1000;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.btn-group {
  display: flex;
  gap: 8px;
}

.control-btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.control-btn:hover {
  background: #4338ca;
}

.control-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
}

.control-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.time-display {
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-display .highlight {
  color: #38bdf8;
  font-weight: bold;
}

.divider {
  color: #475569;
}

.fps-badge {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.tracks-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  padding: 8px 0;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  pointer-events: none;
  z-index: 10;
  transform: translateX(-50%);
}

.playhead-line {
  width: 2px;
  height: 100%;
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
}

.track-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 20px;
}

.track-label {
  width: 130px;
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-timeline {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  position: relative;
}

.keyframe-diamond {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  background: #38bdf8;
  transform: translate(-50%, -50%) rotate(45deg);
  border-radius: 1px;
  border: 1px solid #0f172a;
  cursor: pointer;
  transition:
    transform 0.15s,
    background 0.15s;
}

.keyframe-diamond:hover {
  background: #facc15;
  transform: translate(-50%, -50%) rotate(45deg) scale(1.3);
}
</style>
