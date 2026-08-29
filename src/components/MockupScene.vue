<script setup lang="ts">
import { ref, shallowRef, watchEffect, computed, onMounted, onUnmounted } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { ContactShadows } from '@tresjs/cientos'
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
const cameraRotation = ref<[number, number, number]>([0, 0, 0])

const hasCameraRotation = computed(() => !!props.config.camera?.keyframes?.rotation)

const devicesConfig = computed(() => {
  return props.config.devices || (props.config.device ? [props.config.device] : [])
})

// Background Setup
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
  return texture
}

// Texture Loader & Cache
const texLoader = new THREE.TextureLoader()
const textureCache = new Map<string, THREE.Texture>()

const loadCachedTexture = async (url?: string): Promise<THREE.Texture> => {
  if (!url) return createFallbackTexture()
  if (textureCache.has(url)) return textureCache.get(url)!
  try {
    const tex = await texLoader.loadAsync(url)
    tex.colorSpace = THREE.SRGBColorSpace
    textureCache.set(url, tex)
    return tex
  } catch {
    return createFallbackTexture()
  }
}

// Dynamic UV Configurator per Device
function applyTextureTransform(
  sourceTex: THREE.Texture,
  transformConfig?: {
    rotation?: number
    flipX?: boolean
    flipY?: boolean
    offset?: [number, number]
    repeat?: [number, number]
    center?: [number, number]
  },
): THREE.Texture {
  const tex = sourceTex.clone()
  const rot = transformConfig?.rotation ?? 0
  const flipX = transformConfig?.flipX ?? false
  const flipY = transformConfig?.flipY ?? false
  const center = transformConfig?.center ?? [0.5, 0.5]
  const repX = (transformConfig?.repeat?.[0] ?? 1) * (flipX ? -1 : 1)
  const repY = (transformConfig?.repeat?.[1] ?? 1) * (flipY ? -1 : 1)

  tex.center.set(center[0], center[1])
  tex.rotation = rot
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repX, repY)

  if (transformConfig?.offset) {
    tex.offset.set(transformConfig.offset[0], transformConfig.offset[1])
  }

  tex.anisotropy = 16
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

// 3D Model Loading & Binding
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

  const autoCenter = dConf.autoCenter ?? true
  const autoScale = dConf.autoScale ?? true
  const customScale = typeof dConf.scale === 'number' ? dConf.scale : 1.0
  const targetScale = (autoScale ? 2.4 / (maxDim || 1) : 1.0) * customScale

  if (autoCenter) {
    scene.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale)
  }
  scene.scale.setScalar(targetScale)

  const wrapperGroup = new THREE.Group()
  wrapperGroup.add(scene)

  // Resolve Screen Media & Per-Device UV Configuration
  const deviceMedia = dConf.screenMedia || activeScreenMedia
  const baseTex = await loadCachedTexture(deviceMedia)
  const uvTransform =
    dConf.screenTransform ||
    props.overrides?.screenTransform ||
    props.config.variables?.screenTransform ||
    {}
  const deviceScreenTexture = applyTextureTransform(baseTex, uvTransform)

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
      if (mesh.geometry) mesh.geometry.computeVertexNormals()

      const material = mesh.material as THREE.MeshStandardMaterial
      const matName = material?.name || ''
      const nodeName = mesh.name || ''
      const mapName = material?.map?.name || ''

      const isScreen =
        targetScreen &&
        (nodeName.includes(targetScreen) ||
          matName.includes(targetScreen) ||
          mapName.includes(targetScreen))

      const isChassis =
        targetChassis === '*' ||
        (targetChassis &&
          (nodeName.includes(targetChassis) ||
            matName.includes(targetChassis) ||
            mapName.includes(targetChassis)))

      if (isScreen) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x000000),
          emissiveMap: deviceScreenTexture,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: dConf.materials?.screen?.emissiveIntensity ?? 1.2,
          roughness: dConf.materials?.screen?.roughness ?? 0.05,
          metalness: 0.0,
        })
      } else if (isChassis) {
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

// Keyframe Interpolation Loop
watchEffect(() => {
  const frame = props.currentFrame
  const camPos = evaluateKeyframes(props.config.camera?.keyframes?.position, frame)
  const camRot = evaluateKeyframes(props.config.camera?.keyframes?.rotation, frame)

  if (camPos && camPos.length === 3) {
    cameraPosition.value = [camPos[0]!, camPos[1]!, camPos[2]!]
  }
  if (camRot && camRot.length === 3) {
    cameraRotation.value = [camRot[0]!, camRot[1]!, camRot[2]!]
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

// Dynamic Post-Processing & Lights
const bloomConfig = computed(() => ({
  intensity: props.config.postProcessing?.bloom?.intensity ?? 0.3,
  luminanceThreshold: props.config.postProcessing?.bloom?.luminanceThreshold ?? 0.95,
  luminanceSmoothing: props.config.postProcessing?.bloom?.luminanceSmoothing ?? 0.2,
  mipmapBlur: props.config.postProcessing?.bloom?.mipmapBlur ?? true,
}))

const ambientLight = computed(() => {
  const amb = props.config.lights?.ambient
  return {
    intensity: amb?.intensity ?? 1.0,
    color: amb?.color ?? '#ffffff',
  }
})

const directionalLights = computed(() => {
  return (
    props.config.lights?.directional || [
      { position: [4, 6, 3], intensity: 1.8, color: '#ffffff' },
      { position: [-4, -3, -2], intensity: 0.6, color: '#ffffff' },
    ]
  )
})

const pointLights = computed(() => {
  return props.config.lights?.point || []
})

// Automatically derived Contact Shadows
const contactShadowsConfig = computed(() => {
  const raw = props.config?.contactShadows
  if (!raw) return null

  const cfg = typeof raw === 'boolean' ? {} : raw
  if (cfg.position && cfg.scale) return cfg

  if (deviceInstances.value.length === 0) return null

  let minY = Infinity
  let minX = Infinity,
    maxX = -Infinity
  let minZ = Infinity,
    maxZ = -Infinity

  deviceInstances.value.forEach((inst, i) => {
    const pos = devicePositions.value[i] || [0, 0, 0]
    const box = new THREE.Box3().setFromObject(inst.group)
    minY = Math.min(minY, box.min.y + pos[1])
    minX = Math.min(minX, box.min.x + pos[0])
    maxX = Math.max(maxX, box.max.x + pos[0])
    minZ = Math.min(minZ, box.min.z + pos[2])
    maxZ = Math.max(maxZ, box.max.z + pos[2])
  })

  if (minY === Infinity) return null
  const autoScale = Math.max(maxX - minX, maxZ - minZ) * (cfg.scaleMultiplier ?? 1.6)

  return {
    position: cfg.position || [(minX + maxX) / 2, minY - 0.005, (minZ + maxZ) / 2],
    scale: cfg.scale || Math.max(autoScale, 3.0),
    opacity: cfg.opacity ?? 0.85,
    blur: cfg.blur ?? 2.2,
    far: cfg.far ?? 3.5,
    color: cfg.color || '#070b1e',
    resolution: cfg.resolution ?? 512,
  }
})

const elementsConfig = computed(() => props.config?.elements || [])
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

      <!-- Free Euler Rotation Camera -->
      <TresPerspectiveCamera
        v-if="hasCameraRotation"
        ref="cameraRef"
        :position="cameraPosition"
        :rotation="cameraRotation"
        :aspect="outWidth / outHeight"
        :fov="config.camera?.fov || 34"
      />

      <!-- Look-At Target Camera -->
      <TresPerspectiveCamera
        v-else
        ref="cameraRef"
        :position="cameraPosition"
        :look-at="config.camera?.lookAt ?? [0, 0, 0]"
        :aspect="outWidth / outHeight"
        :fov="config.camera?.fov || 34"
      />

      <!-- Dynamic Ambient Light -->
      <TresAmbientLight :intensity="ambientLight.intensity" :color="ambientLight.color" />

      <!-- Dynamic Directional Lights (Key, Fill, Rim) -->
      <TresDirectionalLight
        v-for="(light, idx) in directionalLights"
        :key="`dir-${idx}`"
        :position="light.position"
        :intensity="light.intensity"
        :color="light.color || '#ffffff'"
      />

      <!-- Dynamic Point Lights (Light Spill, Neon Bounce) -->
      <TresPointLight
        v-for="(light, idx) in pointLights"
        :key="`pt-${idx}`"
        :position="light.position"
        :intensity="light.intensity"
        :color="light.color || '#ffffff'"
        :distance="light.distance || 0"
        :decay="light.decay ?? 2"
      />

      <!-- Auto-Generated Contact Shadows -->
      <ContactShadows
        v-if="contactShadowsConfig"
        :position="contactShadowsConfig.position"
        :opacity="contactShadowsConfig.opacity"
        :blur="contactShadowsConfig.blur"
        :scale="contactShadowsConfig.scale"
        :far="contactShadowsConfig.far"
        :resolution="contactShadowsConfig.resolution"
        :color="contactShadowsConfig.color"
      />

      <!-- Dynamic Stage Elements & Neon Primitives -->
      <TresMesh
        v-for="(el, idx) in elementsConfig"
        :key="`el-${idx}`"
        :position="el.position || [0, 0, 0]"
        :rotation="el.rotation || [0, 0, 0]"
        :scale="el.scale || 1"
      >
        <TresTorusGeometry v-if="el.type === 'torus'" :args="el.args" />
        <TresCylinderGeometry v-else-if="el.type === 'cylinder'" :args="el.args" />
        <TresPlaneGeometry v-else-if="el.type === 'plane'" :args="el.args" />

        <TresMeshBasicMaterial
          v-if="el.material?.type === 'basic'"
          :color="el.material.color"
          :tone-mapped="el.material.toneMapped ?? true"
          :transparent="el.material.transparent ?? false"
          :opacity="el.material.opacity ?? 1"
        />
        <TresMeshStandardMaterial
          v-else
          :color="el.material?.color || '#ffffff'"
          :roughness="el.material?.roughness ?? 0.5"
          :metalness="el.material?.metalness ?? 0.0"
          :emissive="el.material?.emissive || '#000000'"
          :emissive-intensity="el.material?.emissiveIntensity ?? 1.0"
          :tone-mapped="el.material?.toneMapped ?? true"
        />
      </TresMesh>

      <!-- Dynamic Device Instances -->
      <primitive
        v-for="(instance, index) in deviceInstances"
        :key="`dev-${index}`"
        :object="instance.group"
        :position="devicePositions[index]"
        :rotation="deviceRotations[index]"
      />

      <!-- Dynamic Post-Processing with Multisampling (MSAA) -->
      <EffectComposerPmndrs :multisampling="8">
        <BloomPmndrs
          :intensity="bloomConfig.intensity"
          :luminance-threshold="bloomConfig.luminanceThreshold"
          :luminance-smoothing="bloomConfig.luminanceSmoothing"
          :mipmap-blur="bloomConfig.mipmapBlur"
        />
      </EffectComposerPmndrs>
    </TresCanvas>
  </div>
</template>