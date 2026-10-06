<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useViewportScale } from '../composables/useViewportScale'
import { FERAL_GRADIENTS } from '../constants/gradients'
import type { Project2DConfig, CardWindowSettings } from '../utils/types'

const props = defineProps<{
  config: Project2DConfig
  overrides?: Record<string, unknown>
  currentFrame?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

// Support dynamic resolution overrides
const baseW = computed(() => (props.overrides?.outputWidth as number) ?? props.config.output.width)
const baseH = computed(
  () => (props.overrides?.outputHeight as number) ?? props.config.output.height,
)
const { containerStyle } = useViewportScale(baseW, baseH)
const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio ?? 1, 2) : 2

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []

  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }

    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      if (!word) continue
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = ctx.measureText(testLine).width

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

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

// 1. Terminal / Developer Window Chrome (Upgraded typography & size)
function drawTerminalChrome(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  title?: string,
  fontFam = 'monospace',
) {
  const dotY = cardY + 32
  const dotRadius = 8
  const startX = cardX + 32
  const gap = 22
  const colors = ['#ef4444', '#f59e0b', '#10b981']
  colors.forEach((color, idx) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(startX + idx * gap, dotY, dotRadius, 0, Math.PI * 2)
    ctx.fill()
  })

  if (title) {
    ctx.font = `600 18px ${fontFam}`
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.fillText(title, cardX + cardW / 2, cardY + 38)
  }
}

// 2. Production Camera Monitor / Viewfinder Chrome (Upgraded from 12px -> 18px & enhanced contrast)
function drawViewfinderChrome(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  card: CardWindowSettings,
  fontFam = 'monospace',
) {
  const bracketSize = 28
  const pad = 20

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.lineWidth = 2.5

  // 4 Corner viewfinder brackets
  ctx.beginPath()
  ctx.moveTo(cardX + pad, cardY + pad + bracketSize)
  ctx.lineTo(cardX + pad, cardY + pad)
  ctx.lineTo(cardX + pad + bracketSize, cardY + pad)

  ctx.moveTo(cardX + cardW - pad - bracketSize, cardY + pad)
  ctx.lineTo(cardX + cardW - pad, cardY + pad)
  ctx.lineTo(cardX + cardW - pad, cardY + pad + bracketSize)

  ctx.moveTo(cardX + pad, cardY + cardH - pad - bracketSize)
  ctx.lineTo(cardX + pad, cardY + cardH - pad)
  ctx.lineTo(cardX + pad + bracketSize, cardY + cardH - pad)

  ctx.moveTo(cardX + cardW - pad - bracketSize, cardY + cardH - pad)
  ctx.lineTo(cardX + cardW - pad, cardY + cardH - pad)
  ctx.lineTo(cardX + cardW - pad, cardY + cardH - pad - bracketSize)
  ctx.stroke()

  // Center subtle reticle
  const midX = cardX + cardW / 2
  const midY = cardY + cardH / 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(midX - 12, midY)
  ctx.lineTo(midX + 12, midY)
  ctx.moveTo(midX, midY - 12)
  ctx.lineTo(midX, midY + 12)
  ctx.stroke()
  ctx.restore()

  // Red REC tally dot & Timecode (Prominent and legible)
  const headerContentY = cardY + 42
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.arc(cardX + 38, headerContentY - 5, 7, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = `bold 18px ${fontFam}`
  ctx.fillStyle = '#ef4444'
  ctx.textAlign = 'left'
  ctx.fillText('REC', cardX + 54, headerContentY)

  ctx.fillStyle = '#f1f5f9'
  ctx.font = `600 18px ${fontFam}`
  ctx.fillText(card.timecode || '01:00:00:00', cardX + 104, headerContentY)

  // Title in the center (High contrast & legible)
  if (card.title) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#cbd5e1'
    ctx.font = `600 17px ${fontFam}`
    ctx.fillText(card.title, cardX + cardW / 2, headerContentY)
  }

  // FPS badge on the right
  if (card.fpsBadge) {
    ctx.textAlign = 'right'
    ctx.fillStyle = '#38bdf8'
    ctx.font = `bold 18px ${fontFam}`
    ctx.fillText(card.fpsBadge, cardX + cardW - 38, headerContentY)
  }
}

// 3. Film Clapperboard Slate Chrome (Upgraded labels and values)
function drawSlateChrome(
  ctx: CanvasRenderingContext2D,
  cardX: number,
  cardY: number,
  cardW: number,
  card: CardWindowSettings,
  fontFam = 'monospace',
) {
  const stripeH = 30
  ctx.save()
  ctx.beginPath()
  ctx.rect(cardX, cardY, cardW, stripeH)
  ctx.clip()

  const stripeWidth = 36
  for (let sx = cardX - stripeWidth; sx < cardX + cardW + stripeWidth; sx += stripeWidth) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(sx, cardY + stripeH)
    ctx.lineTo(sx + 16, cardY)
    ctx.lineTo(sx + 32, cardY)
    ctx.lineTo(sx + 16, cardY + stripeH)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  const scene = card.sceneData
  if (scene) {
    const boxY = cardY + stripeH + 12
    const boxW = Math.min(cardW - 64, 440)
    const boxStartX = cardX + 32
    const colW = boxW / 3

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(boxStartX, boxY, boxW, 42)

    const cols = [
      { label: 'ROLL', val: scene.roll || 'A01' },
      { label: 'SCENE', val: scene.scene || '10A' },
      { label: 'TAKE', val: scene.take || '01' },
    ]

    cols.forEach((col, idx) => {
      const cx = boxStartX + idx * colW
      if (idx > 0) {
        ctx.beginPath()
        ctx.moveTo(cx, boxY)
        ctx.lineTo(cx, boxY + 42)
        ctx.stroke()
      }
      ctx.font = `bold 12px ${fontFam}`
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      ctx.fillText(col.label, cx + colW / 2, boxY + 16)

      ctx.font = `bold 18px ${fontFam}`
      ctx.fillStyle = '#ffffff'
      ctx.fillText(col.val, cx + colW / 2, boxY + 34)
    })
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

  const cardW = Math.min(card.maxWidth ?? 1440, w * 0.88)
  const cardRadius = card.borderRadius ?? 20
  const fontSize = content.fontSize ?? 48
  const lineHeight = content.lineHeight ?? 60
  const fontFam = content.fontFamily ?? "'JetBrains Mono', 'Fira Code', monospace"
  const cardType = card.type ?? 'terminal'

  ctx.font = `${fontSize}px ${fontFam}`
  const contentW = cardW - (showLineNumbers ? 140 : 88)
  const lines = wrapText(ctx, rawText, contentW)

  const headerH = cardType === 'slate' ? 96 : cardType === 'viewfinder' ? 72 : 60
  const innerPaddingY = 38
  const contentH = Math.max(lines.length * lineHeight, 80)
  const cardH = headerH + innerPaddingY + contentH + innerPaddingY

  const cardX = (w - cardW) / 2
  const cardY = Math.max(32, (h - cardH) / 2 - 20)

  // Card Base & Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = card.shadowBlur ?? 48
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 24

  ctx.fillStyle = '#14151b'
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius)
  ctx.fill()
  ctx.restore()

  // Border stroke
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius)
  ctx.stroke()

  // Render modular card chrome
  if (cardType === 'viewfinder') {
    drawViewfinderChrome(ctx, cardX, cardY, cardW, cardH, card, fontFam)
  } else if (cardType === 'slate') {
    drawSlateChrome(ctx, cardX, cardY, cardW, card, fontFam)
  } else {
    if (card.showControls !== false) {
      drawTerminalChrome(ctx, cardX, cardY, cardW, title, fontFam)
    }
  }

  // Render Main Content Lines
  ctx.textAlign = 'left'
  const textStartY = cardY + headerH + innerPaddingY + 8

  lines.forEach((lineText, idx) => {
    const currentY = textStartY + idx * lineHeight

    if (showLineNumbers) {
      ctx.font = `${fontSize - 4}px ${fontFam}`
      ctx.fillStyle = '#64748b'
      ctx.fillText(`${idx + 1}`, cardX + 36, currentY)
    }

    if (lineText) {
      ctx.font = `${fontSize}px ${fontFam}`
      ctx.fillStyle = '#f8fafc'
      const lineX = cardX + (showLineNumbers ? 88 : 44)
      ctx.fillText(lineText, lineX, currentY)
    }
  })

  // Footer Metadata (Upgraded from 15px to 22px bold)
  const footerY = cardY + cardH + 46
  ctx.font = `bold 22px ${fontFam}`
  ctx.fillStyle = '#e2e8f0'

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
  () => [props.config, props.overrides, props.currentFrame, baseW.value, baseH.value],
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
      class="h-full w-full"
      :style="{ width: `${baseW}px`, height: `${baseH}px` }"
    />
  </div>
</template>