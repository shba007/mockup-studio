<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useViewportScale } from '../composables/useViewportScale'
import { FERAL_GRADIENTS } from '../constants/gradients'
import type { Project2DConfig } from '../utils/types'

const props = defineProps<{
  config: Project2DConfig
  overrides?: Record<string, unknown>
  currentFrame?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const baseW = computed(() => props.config.output.width)
const baseH = computed(() => props.config.output.height)
const { containerStyle } = useViewportScale(baseW, baseH)
const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio ?? 1, 2) : 2

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = ctx.measureText(testLine).width
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bgVal = (props.overrides?.background as string) ?? props.config.background.value
  const preset = FERAL_GRADIENTS.find((g) => g.id === bgVal) ?? FERAL_GRADIENTS[0]!

  ctx.fillStyle = preset.baseColor
  ctx.fillRect(0, 0, w, h)

  for (const spot of preset.spots) {
    const cx = w * spot.x
    const cy = h * spot.y
    const radius = Math.max(w, h) * spot.r
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
    grad.addColorStop(0, spot.color)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = baseW.value
  const h = baseH.value

  canvas.width = w * dpr
  canvas.height = h * dpr
  ctx.resetTransform()
  ctx.scale(dpr, dpr)

  drawBackground(ctx, w, h)

  const card = props.config.card
  const content = props.config.content
  const rawText = (props.overrides?.text as string) ?? content.text
  const title = (props.overrides?.title as string) ?? card.title
  const metaLeft = (props.overrides?.metaLeft as string) ?? content.metaLeft
  const metaRight = (props.overrides?.metaRight as string) ?? content.metaRight
  const showLineNumbers =
    (props.overrides?.showLineNumbers as boolean | undefined) ?? content.showLineNumbers

  const cardW = Math.min(card.maxWidth ?? 1020, w * 0.88)
  const cardRadius = card.borderRadius ?? 20
  const fontSize = content.fontSize ?? 20
  const lineHeight = content.lineHeight ?? 34
  const fontFam = content.fontFamily ?? "'JetBrains Mono', 'Fira Code', monospace"

  ctx.font = `${fontSize}px ${fontFam}`
  const contentW = cardW - (showLineNumbers ? 120 : 64)
  const lines = wrapText(ctx, rawText, contentW)
  const headerH = 50
  const innerPaddingY = 32
  const contentH = Math.max(lines.length * lineHeight, 80)
  const cardH = headerH + innerPaddingY + contentH + innerPaddingY

  const cardX = (w - cardW) / 2
  const cardY = (h - cardH) / 2 - 12

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 18

  ctx.fillStyle = '#1b1d24'
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius)
  ctx.fill()
  ctx.restore()

  if (card.showControls !== false) {
    const dotY = cardY + 28
    const dotRadius = 6.5
    const startX = cardX + 28
    const gap = 18
    const colors = ['#ef4444', '#f59e0b', '#10b981']
    colors.forEach((color, idx) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(startX + idx * gap, dotY, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  ctx.font = `14px ${fontFam}`
  ctx.fillStyle = '#71717a'
  ctx.textAlign = 'center'
  if (title) ctx.fillText(title, cardX + cardW / 2, cardY + 33)

  ctx.textAlign = 'left'
  const textStartY = cardY + headerH + innerPaddingY + 4

  lines.forEach((lineText, idx) => {
    const currentY = textStartY + idx * lineHeight

    if (showLineNumbers) {
      ctx.font = `${fontSize - 2}px ${fontFam}`
      ctx.fillStyle = '#64748b'
      ctx.fillText(`${idx + 1}`, cardX + 32, currentY)
    }

    ctx.font = `${fontSize}px ${fontFam}`
    ctx.fillStyle = '#f1f5f9'
    const lineX = cardX + (showLineNumbers ? 76 : 32)
    ctx.fillText(lineText, lineX, currentY)
  })

  const footerY = cardY + cardH + 42
  ctx.font = `600 16px ${fontFam}`
  ctx.fillStyle = '#ffffff'

  if (metaLeft) {
    ctx.textAlign = 'left'
    ctx.fillText(metaLeft, cardX + 4, footerY)
  }

  if (metaRight) {
    ctx.textAlign = 'right'
    ctx.fillText(metaRight, cardX + cardW - 4, footerY)
  }
}

watch(
  () => [props.config, props.overrides, props.currentFrame],
  () => {
    requestAnimationFrame(render)
  },
  { deep: true },
)

onMounted(render)
</script>

<template>
  <div class="absolute top-1/2 left-1/2 origin-center overflow-hidden" :style="containerStyle">
    <canvas
      ref="canvasRef"
      class="h-full w-full rounded-[28px] shadow-2xl"
      :style="{ width: `${baseW}px`, height: `${baseH}px` }"
    />
  </div>
</template>