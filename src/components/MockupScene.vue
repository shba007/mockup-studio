<script setup lang="ts">
import { ref, shallowRef, watchEffect, computed, onMounted, onUnmounted } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposerPmndrs, BloomPmndrs } from '@tresjs/post-processing'
import { evaluateKeyframes } from '../utils/interpolator'

const props = defineProps<{
  config: Record<string, unknown>
  overrides: Record<string, unknown>
  currentFrame: number
}>()

const cameraRef = shallowRef<THREE.PerspectiveCamera>()
const cameraPosition = ref<[number, number, number]>([0, 0, 4.2])

const devicesConfig = computed(() => {
  return props.config.devices || (props.config.device ? [props.config.device] : [])
})

const activeScreenMedia = (props.overrides?.screenMedia || props.config.variables?.screenMedia) as
  | string
  | undefined
const activeBg = (props.overrides?.backgroundColor ||
  props.config.variables?.backgroundGradient ||
  props.config.variables?.backgroundColor ||
  '#0d0f12') as string

const bgTexture = shallowRef<THREE.CanvasTexture>()

function generateBackgroundTexture() {
  const bgCanvas = document.createElement('canvas')
  const outW = props.config.output?.width || 1920
  const outH = props.config.output?.height || 1080
  const maxRes = 4096
  const scale = maxRes / Math.max(outW, outH)

  bgCanvas.width = outW * scale
  bgCanvas.height = outH * scale

  const ctx = bgCanvas.getContext('2d')
  if (!ctx) return

  if (activeBg.includes('gradient')) {
    const colors = activeBg.match(/#[a-fA-F0-9]{3,6}/g) || ['#5945ea', '#2b2b2b']
    const cx = bgCanvas.width / 2
    const cy = bgCanvas.height / 2
    const r = Math.sqrt(cx * cx + cy * cy)

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, colors[0])
    grad.addColorStop(1, colors[1] || colors[0])
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = activeBg
  }

  ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height)
  const tex = new THREE.CanvasTexture(bgCanvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  bgTexture.value = tex
}
generateBackgroundTexture()

function createFallbackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1179
  canvas.height = 2556
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  grad.addColorStop(0, '#4f46e5')
  grad.addColorStop(1, '#06b6d4')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('App Screen Preview', canvas.width / 2, canvas.height / 2 - 40)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.center.set(0.5, 0.5)
  texture.rotation = Math.PI
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.x = -1
  texture.anisotropy = 16
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  return texture
}

let screenTexture: THREE.Texture
if (activeScreenMedia) {
  try {
    const texLoader = new THREE.TextureLoader()
    screenTexture = await texLoader.loadAsync(activeScreenMedia)
    screenTexture.colorSpace = THREE.SRGBColorSpace
    screenTexture.flipY = false
    screenTexture.center.set(0.5, 0.5)
    screenTexture.rotation = Math.PI
    screenTexture.wrapS = THREE.RepeatWrapping
    screenTexture.repeat.x = -1
    screenTexture.anisotropy = 16
    screenTexture.minFilter = THREE.LinearMipmapLinearFilter
    screenTexture.magFilter = THREE.LinearFilter
    screenTexture.generateMipmaps = true
  } catch {
    screenTexture = createFallbackTexture()
  }
} else {
  screenTexture = createFallbackTexture()
}

const gltfLoader = new GLTFLoader()
const modelCache = new Map<string, THREE.Group>()

const loadCachedModel = async (url: string) => {
  if (modelCache.has(url)) return modelCache.get(url)!
  const gltf = await gltfLoader.loadAsync(url)
  modelCache.set(url, gltf.scene)
  return gltf.scene
}

const deviceInstances = shallowRef<
  { group: THREE.Group; initialTransforms: Map<string, unknown> }[]
>([])
const devicePositions = ref<[number, number, number][]>([])
const deviceRotations = ref<[number, number, number][]>([])

const instancesTemp = []
const positionsTemp = []
const rotationsTemp = []

for (let i = 0; i < devicesConfig.value.length; i++) {
  const dConf = devicesConfig.value[i]
  const baseScene = await loadCachedModel(dConf.modelUrl)
  const scene = SkeletonUtils.clone(baseScene) as THREE.Group

  const box = new THREE.Box3().setFromObject(scene)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const targetScale = 2.4 / (maxDim || 1)

  scene.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale)
  scene.scale.setScalar(targetScale)

  const wrapperGroup = new THREE.Group()
  wrapperGroup.add(scene)

  const initialTransforms = new Map()
  const targetScreen = dConf.meshBindings?.screen
  const targetChassis = dConf.meshBindings?.chassis
  const chassisColor = props.overrides?.chassisColor || dConf.materials?.chassis?.color || '#242426'

  scene.traverse((child: THREE.Object3D) => {
    initialTransforms.set(child.name, {
      rotation: child.rotation.clone(),
      position: child.position.clone(),
    })

    const mesh = child as THREE.Mesh
    if (mesh.isMesh) {
      const material = mesh.material as THREE.MeshStandardMaterial
      const matName = material?.name || ''
      const nodeName = mesh.name || ''
      const mapName = material?.map?.name || ''

      const isScreen =
        nodeName.includes(targetScreen) ||
        matName.includes(targetScreen) ||
        mapName.includes(targetScreen)
      const isChassis =
        nodeName.includes(targetChassis) ||
        matName.includes(targetChassis) ||
        mapName.includes(targetChassis)

      if (isScreen) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x000000),
          emissiveMap: screenTexture,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: dConf.materials?.screen?.emissiveIntensity ?? 1.2,
          roughness: dConf.materials?.screen?.roughness ?? 0.1,
          metalness: 0.0,
        })
      }

      if (isChassis) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(chassisColor as string),
          metalness: dConf.materials?.chassis?.metalness ?? 0.85,
          roughness: dConf.materials?.chassis?.roughness ?? 0.25,
        })
      }
    }
  })

  instancesTemp.push({ group: wrapperGroup, initialTransforms })
  positionsTemp.push([0, 0, 0])
  rotationsTemp.push([0, 0, 0])
}

deviceInstances.value = instancesTemp
devicePositions.value = positionsTemp as [number, number, number][]
deviceRotations.value = rotationsTemp as [number, number, number][]

watchEffect(() => {
  const frame = props.currentFrame
  const camPos = evaluateKeyframes(props.config.camera?.keyframes?.position, frame)

  if (camPos && camPos.length === 3) {
    cameraPosition.value = [camPos[0]!, camPos[1]!, camPos[2]!]
  }

  devicesConfig.value.forEach((dConf, i: number) => {
    const pos = evaluateKeyframes(dConf.keyframes?.position, frame)
    const rot = evaluateKeyframes(dConf.keyframes?.rotation, frame)

    if (pos && pos.length === 3) devicePositions.value[i] = [pos[0]!, pos[1]!, pos[2]!]
    if (rot && rot.length === 3) deviceRotations.value[i] = [rot[0]!, rot[1]!, rot[2]!]

    const nodeKeyframes = dConf.keyframes?.nodes
    const instanceData = deviceInstances.value[i]
    if (nodeKeyframes && instanceData) {
      for (const [nodeName, tracks] of Object.entries(nodeKeyframes)) {
        const targetNode = instanceData.group.getObjectByName(nodeName)
        const initial = instanceData.initialTransforms.get(nodeName)

        if (targetNode && initial) {
          if (tracks.rotation) {
            const nRot = evaluateKeyframes(tracks.rotation, frame)
            targetNode.rotation.set(
              initial.rotation.x + nRot[0],
              initial.rotation.y + nRot[1],
              initial.rotation.z + nRot[2],
            )
          }
          if (tracks.position) {
            const nPos = evaluateKeyframes(tracks.position, frame)
            targetNode.position.set(
              initial.position.x + nPos[0],
              initial.position.y + nPos[1],
              initial.position.z + nPos[2],
            )
          }
        }
      }
    }
  })
})

const outWidth = computed(() => props.config.output?.width || 1920)
const outHeight = computed(() => props.config.output?.height || 1080)
const windowScale = ref(1)

function updateScale() {
  if (typeof window !== 'undefined') {
    const scaleX = window.innerWidth / outWidth.value
    const scaleY = window.innerHeight / outHeight.value
    windowScale.value = Math.max(scaleX, scaleY)
  }
}

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
})

const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1
</script>

<template>
  <div
    class="absolute top-1/2 left-1/2 origin-center overflow-hidden"
    :style="{
      width: `${outWidth}px`,
      height: `${outHeight}px`,
      transform: `translate(-50%, -50%) scale(${windowScale})`,
    }"
  >
    <TresCanvas
      :pixel-ratio="pixelRatio"
      :output-color-space="THREE.SRGBColorSpace"
      :gl="{ preserveDrawingBuffer: true, antialias: true }"
    >
      <primitive v-if="bgTexture" :object="bgTexture" attach="background" />

      <TresPerspectiveCamera
        ref="cameraRef"
        :position="cameraPosition"
        :aspect="outWidth / outHeight"
        :fov="(config.camera as any)?.fov || 34"
        :look-at="[0, 0, 0]"
      />

      <TresAmbientLight :intensity="1.8" />
      <TresDirectionalLight :position="[4, 6, 3]" :intensity="3.0" />
      <TresDirectionalLight :position="[-4, -3, -2]" :intensity="1.2" />

      <primitive
        v-for="(instance, index) in deviceInstances"
        :key="index"
        :object="instance.group"
        :position="devicePositions[index]"
        :rotation="deviceRotations[index]"
      />

      <EffectComposerPmndrs>
        <BloomPmndrs :luminance-threshold="0.9" :intensity="0.6" :mipmap-blur="true" />
      </EffectComposerPmndrs>
    </TresCanvas>
  </div>
</template>