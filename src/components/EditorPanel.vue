<script setup lang="ts">
import { ref, computed } from 'vue'
import { FERAL_GRADIENTS } from '../constants/gradients'
import { PLATFORM_PRESETS } from '../constants/presets'
import type {
  SceneAnimationConfig,
  Project2DConfig,
  Project3DConfig,
  ScreenFitMode,
} from '../utils/types'

const props = defineProps<{
  config: SceneAnimationConfig
  overrides: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'updateOverride', key: string, val: unknown): void
  (e: 'close'): void
}>()

const activeTab = ref<'design' | 'content' | 'settings'>('design')
const selectedCategory = ref<'all' | 'flow' | 'sunset' | 'dark'>('all')

const is2D = computed(() => props.config.kind === '2d')
const config2D = computed(() => props.config as Project2DConfig)
const config3D = computed(() => props.config as Project3DConfig)

const filteredGradients = computed(() => {
  if (selectedCategory.value === 'all') return FERAL_GRADIENTS
  return FERAL_GRADIENTS.filter((g) => g.category === selectedCategory.value)
})

const activeGradientId = computed(
  () =>
    (props.overrides.background as string) ??
    (is2D.value ? config2D.value.background.value : 'iridescent-cloud'),
)

// Active resolution presets
const currentWidth = computed(
  () => (props.overrides.outputWidth as number) ?? props.config.output.width,
)
const currentHeight = computed(
  () => (props.overrides.outputHeight as number) ?? props.config.output.height,
)

function selectPlatformPreset(w: number, h: number) {
  emit('updateOverride', 'outputWidth', w)
  emit('updateOverride', 'outputHeight', h)
}

function resetToDefaultResolution() {
  emit('updateOverride', 'outputWidth', props.config.output.width)
  emit('updateOverride', 'outputHeight', props.config.output.height)
}

const currentText = computed({
  get: () => (props.overrides.text as string) ?? config2D.value.content.text,
  set: (val: string) => emit('updateOverride', 'text', val),
})

const currentTitle = computed({
  get: () => (props.overrides.title as string) ?? config2D.value.card.title,
  set: (val: string) => emit('updateOverride', 'title', val),
})

const currentLineNumbers = computed({
  get: () => (props.overrides.showLineNumbers as boolean) ?? config2D.value.content.showLineNumbers,
  set: (val: boolean) => emit('updateOverride', 'showLineNumbers', val),
})

const currentMetaLeft = computed({
  get: () => (props.overrides.metaLeft as string) ?? config2D.value.content.metaLeft,
  set: (val: string) => emit('updateOverride', 'metaLeft', val),
})

const currentMetaRight = computed({
  get: () => (props.overrides.metaRight as string) ?? config2D.value.content.metaRight,
  set: (val: string) => emit('updateOverride', 'metaRight', val),
})

const currentScreenMedia = computed({
  get: () => (props.overrides.screenMedia as string) ?? config3D.value.variables?.screenMedia ?? '',
  set: (val: string) => emit('updateOverride', 'screenMedia', val),
})

const currentScreenFit = computed({
  get: () => (props.overrides.screenFit as ScreenFitMode) ?? 'cover',
  set: (val: ScreenFitMode) => emit('updateOverride', 'screenFit', val),
})

const currentChassisColor = computed({
  get: () =>
    (props.overrides.chassisColor as string) ?? config3D.value.variables?.chassisColor ?? '#121316',
  set: (val: string) => emit('updateOverride', 'chassisColor', val),
})

const fitOptions = [
  { id: 'fit', label: 'Fit' },
  { id: 'cover', label: 'Cover' },
  { id: 'stretch', label: 'Stretch' },
] as const

function conicStyle(colors: [string, string, string, string]) {
  return {
    background: `conic-gradient(from 0deg, ${colors[0]} 0deg 90deg, ${colors[1]} 90deg 180deg, ${colors[2]} 180deg 270deg, ${colors[3]} 270deg 360deg)`,
  }
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      emit('updateOverride', 'screenMedia', reader.result)
    }
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <aside
    class="absolute top-16 left-5 z-50 flex max-h-[85vh] w-[340px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#161720]/95 font-sans text-slate-200 shadow-2xl backdrop-blur-2xl transition-all"
  >
    <div class="flex items-center justify-between border-b border-white/10 p-3">
      <div class="flex rounded-full bg-[#20222e] p-0.5">
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition"
          :class="
            activeTab === 'design'
              ? 'bg-white text-zinc-900 shadow'
              : 'text-zinc-400 hover:text-white'
          "
          @click="activeTab = 'design'"
        >
          Design
        </button>
        <button
          v-if="is2D"
          type="button"
          class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition"
          :class="
            activeTab === 'content'
              ? 'bg-white text-zinc-900 shadow'
              : 'text-zinc-400 hover:text-white'
          "
          @click="activeTab = 'content'"
        >
          Text
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition"
          :class="
            activeTab === 'settings'
              ? 'bg-white text-zinc-900 shadow'
              : 'text-zinc-400 hover:text-white'
          "
          @click="activeTab = 'settings'"
        >
          Export Size
        </button>
      </div>

      <button
        type="button"
        class="cursor-pointer rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-xs font-sans">
      <!-- DESIGN TAB -->
      <template v-if="activeTab === 'design'">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Type</span>
          </div>

          <div class="grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1">
            <button
              v-for="cat in ['all', 'flow', 'sunset', 'dark'] as const"
              :key="cat"
              type="button"
              class="cursor-pointer rounded-lg py-1 text-center text-[10px] font-semibold capitalize transition"
              :class="
                selectedCategory === cat
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              "
              @click="selectedCategory = cat"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400"
              >Presets</span
            >
            <span class="text-[10px] text-zinc-500">{{ filteredGradients.length }} palettes</span>
          </div>

          <div class="grid grid-cols-4 gap-3 py-1">
            <button
              v-for="preset in filteredGradients"
              :key="preset.id"
              type="button"
              class="group flex cursor-pointer flex-col items-center gap-1.5"
              @click="emit('updateOverride', 'background', preset.id)"
            >
              <div
                class="size-11 rounded-full border transition-transform duration-150 group-hover:scale-105"
                :class="
                  activeGradientId === preset.id
                    ? 'border-white ring-2 ring-white/60'
                    : 'border-white/10 group-hover:border-white/40'
                "
                :style="conicStyle(preset.colors)"
              />
              <span
                class="w-full truncate text-center text-[10px] font-medium"
                :class="
                  activeGradientId === preset.id
                    ? 'text-white font-semibold'
                    : 'text-zinc-400 group-hover:text-zinc-200'
                "
              >
                {{ preset.name }}
              </span>
            </button>
          </div>
        </div>

        <template v-if="!is2D">
          <div class="flex flex-col gap-3 border-t border-white/10 pt-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400"
              >3D Display</span
            >

            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-medium text-zinc-400">Screen Media</label>
              <input
                type="file"
                accept="image/*"
                class="block w-full text-[11px] text-zinc-400 file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-zinc-900 file:transition hover:file:bg-zinc-200"
                @change="handleFileUpload"
              />
              <input
                v-model="currentScreenMedia"
                type="text"
                placeholder="Or paste image URL / path..."
                class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-white/40"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-medium text-zinc-400">Fitting</label>
              <div class="grid grid-cols-3 gap-1 rounded-xl bg-black/40 p-1">
                <button
                  v-for="opt in fitOptions"
                  :key="opt.id"
                  type="button"
                  class="cursor-pointer rounded-lg py-1.5 text-center text-[10px] font-semibold transition"
                  :class="
                    currentScreenFit === opt.id
                      ? 'bg-white text-zinc-900 shadow'
                      : 'text-zinc-400 hover:text-white'
                  "
                  @click="currentScreenFit = opt.id"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- CONTENT TAB -->
      <template v-else-if="activeTab === 'content' && is2D">
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium text-zinc-400">Content / Question</label>
          <textarea
            v-model="currentText"
            rows="5"
            placeholder="Type your markdown or question text..."
            class="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-100 placeholder-zinc-500 outline-none transition focus:border-white/40 focus:bg-black/60"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-medium text-zinc-400">Window Title</label>
          <input
            v-model="currentTitle"
            type="text"
            placeholder="~/question.md"
            class="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-white/40"
          />
        </div>

        <label class="flex cursor-pointer items-center gap-2 text-zinc-300">
          <input
            v-model="currentLineNumbers"
            type="checkbox"
            class="size-3.5 rounded accent-white"
          />
          <span class="text-[11px]">Show Line Numbers</span>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-medium text-zinc-400">Meta Left</label>
            <input
              v-model="currentMetaLeft"
              type="text"
              class="w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-white/40"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-medium text-zinc-400">Meta Right</label>
            <input
              v-model="currentMetaRight"
              type="text"
              class="w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-white/40"
            />
          </div>
        </div>
      </template>

      <!-- SETTINGS & PLATFORM PRESETS TAB -->
      <template v-else>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400"
              >Platform Export Presets</span
            >
            <button
              type="button"
              class="text-[10px] font-semibold text-blue-400 hover:underline"
              @click="resetToDefaultResolution"
            >
              Reset Default
            </button>
          </div>

          <div class="flex flex-col gap-1.5">
            <button
              v-for="preset in PLATFORM_PRESETS"
              :key="preset.id"
              type="button"
              class="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition"
              :class="
                currentWidth === preset.width && currentHeight === preset.height
                  ? 'border-white/40 bg-white/15 text-white'
                  : 'border-white/5 bg-black/30 text-zinc-300 hover:border-white/20 hover:bg-black/50'
              "
              @click="selectPlatformPreset(preset.width, preset.height)"
            >
              <div class="flex flex-col text-left">
                <span class="font-medium text-[11px]">{{ preset.name }}</span>
                <span class="text-[9px] text-zinc-400"
                  >{{ preset.width }} × {{ preset.height }}</span
                >
              </div>
              <span class="rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-mono text-zinc-300">
                {{ preset.aspectLabel }}
              </span>
            </button>
          </div>
        </div>

        <template v-if="!is2D">
          <div class="flex flex-col gap-1.5 border-t border-white/10 pt-3">
            <label class="text-[11px] font-medium text-zinc-400">Chassis Color</label>
            <div class="flex items-center gap-2">
              <input
                v-model="currentChassisColor"
                type="color"
                class="size-8 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0"
              />
              <input
                v-model="currentChassisColor"
                type="text"
                class="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-100 outline-none focus:border-white/40"
              />
            </div>
          </div>
        </template>

        <div class="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-zinc-400 text-[11px]">
          Output: <strong class="text-white">{{ currentWidth }} × {{ currentHeight }}</strong>
          <br />
          Format: {{ config.kind?.toUpperCase() }} · {{ config.mode?.toUpperCase() }}
        </div>
      </template>
    </div>
  </aside>
</template>