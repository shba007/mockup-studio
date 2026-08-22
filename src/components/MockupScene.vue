<script setup lang="ts">
import { ref, shallowRef, watchEffect } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { evaluateKeyframes } from '../utils/interpolator'

const props = defineProps<{
  config: Record<string, unknown>
  overrides: Record<string, unknown>
  currentFrame: number
}>()

const cameraRef = shallowRef<THREE.PerspectiveCamera>()
const devicePosition = ref<[number, number, number]>([0, 0, 0])
const deviceRotation = ref<[number, number, number]>([0, 0, 0])
const cameraPosition = ref<[number, number, number]>([0, 0, 4.2])

const activeScreenMedia = props.overrides?.screenMedia || props.config.variables?.screenMedia
const activeChassisColor =
  props.overrides?.chassisColor || props.config.variables?.chassisColor || '#242426'
const activeBg =
  props.overrides?.backgroundColor ||
  props.config.variables?.backgroundGradient ||
  props.config.variables?.backgroundColor ||
  '#0d0f12'

// 1. Generate the Radial Gradient Background directly as a ThreeJS Texture
const bgTexture = shallowRef<THREE.CanvasTexture>()

function generateBackgroundTexture() {
  const bgCanvas = document.createElement('canvas')
  // Render a massive 4K gradient so it never looks pixelated when stretched in the browser
  bgCanvas.width = 4096
  bgCanvas.height = 4096

  const ctx = bgCanvas.getContext('2d')
  if (!ctx) return

  if (activeBg.includes('gradient')) {
    const colors = activeBg.match(/#[a-fA-F0-9]{3,6}/g) || ['#5945ea', '#2b2b2b']
    const cx = bgCanvas.width / 2
    const cy = bgCanvas.height / 2
    const r = Math.max(cx, cy)

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

// Generate the background immediately
generateBackgroundTexture()

// 1. Update the Fallback Texture Generator
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

  // Orientation Fix
  texture.flipY = false
  texture.center.set(0.5, 0.5)
  texture.rotation = Math.PI
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.x = -1

  // QUALITY FIXES:
  texture.anisotropy = 16
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true

  return texture
}

// 2. Update the Screen Media Loader
let screenTexture: THREE.Texture
if (activeScreenMedia) {
  try {
    const texLoader = new THREE.TextureLoader()
    screenTexture = await texLoader.loadAsync(activeScreenMedia)
    screenTexture.colorSpace = THREE.SRGBColorSpace

    // Orientation Fix
    screenTexture.flipY = false
    screenTexture.center.set(0.5, 0.5)
    screenTexture.rotation = Math.PI
    screenTexture.wrapS = THREE.RepeatWrapping
    screenTexture.repeat.x = -1

    // QUALITY FIXES: Maximize Anisotropic Filtering
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

// 3. Load & Process the 3D Model
const rootGroup = shallowRef<THREE.Group>(new THREE.Group())
const gltfLoader = new GLTFLoader()
const gltf = await gltfLoader.loadAsync(props.config.device.modelUrl)
const loadedScene = gltf.scene

const box = new THREE.Box3().setFromObject(loadedScene)
const center = box.getCenter(new THREE.Vector3())
const size = box.getSize(new THREE.Vector3())

const maxDim = Math.max(size.x, size.y, size.z)
const targetScale = 2.4 / (maxDim || 1)

loadedScene.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale)
loadedScene.scale.setScalar(targetScale)
rootGroup.value.add(loadedScene)

const targetScreen = props.config.device.meshBindings?.screen
const targetChassis = props.config.device.meshBindings?.chassis
const initialTransforms = new Map()

loadedScene.traverse((child: THREE.Object3D) => {
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
        emissiveIntensity: 1.0,

        roughness: props.config.device.materials?.screen?.roughness ?? 0.1,
        metalness: 0.0,
      })
    }

    if (isChassis) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(activeChassisColor),
        metalness: props.config.device.materials?.chassis?.metalness ?? 0.85,
        roughness: props.config.device.materials?.chassis?.roughness ?? 0.25,
      })
    }
  }
})

watchEffect(() => {
  const frame = props.currentFrame
  const config = props.config as unknown

  const pos = evaluateKeyframes(config.device.keyframes.position, frame)
  const rot = evaluateKeyframes(config.device.keyframes.rotation, frame)
  const cam = evaluateKeyframes(config.camera.keyframes.position, frame)

  devicePosition.value = [pos[0], pos[1], pos[2]]
  deviceRotation.value = [rot[0], rot[1], rot[2]]
  cameraPosition.value = [cam[0], cam[1], cam[2]]

  const nodeKeyframes = config.device.keyframes.nodes
  if (nodeKeyframes && loadedScene) {
    for (const [nodeName, tracks] of Object.entries(nodeKeyframes)) {
      const targetNode = loadedScene.getObjectByName(nodeName)
      const initial = initialTransforms.get(nodeName)

      if (targetNode && initial) {
        if (tracks.rotation) {
          const nRot = evaluateKeyframes(tracks.rotation, frame)
          // Apply animation as an OFFSET to the original rotation
          targetNode.rotation.set(
            initial.rotation.x + nRot[0],
            initial.rotation.y + nRot[1],
            initial.rotation.z + nRot[2],
          )
        }
        if (tracks.position) {
          const nPos = evaluateKeyframes(tracks.position, frame)
          // Apply animation as an OFFSET to the original position
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
const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1
</script>

<template>
  <div class="scene-viewport">
    <TresCanvas
      window-size
      :pixel-ratio="pixelRatio"
      :output-color-space="THREE.SRGBColorSpace"
      :gl="{ preserveDrawingBuffer: true, antialias: true }"
    >
      <primitive v-if="bgTexture" :object="bgTexture" attach="background" />

      <TresPerspectiveCamera
        ref="cameraRef"
        :position="cameraPosition"
        :fov="config.camera?.fov || 34"
        :look-at="[0, 0, 0]"
      />

      <TresAmbientLight :intensity="1.8" />
      <TresDirectionalLight :position="[4, 6, 3]" :intensity="3.0" />
      <TresDirectionalLight :position="[-4, -3, -2]" :intensity="1.2" />

      <primitive :object="rootGroup" :position="devicePosition" :rotation="deviceRotation" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.scene-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
