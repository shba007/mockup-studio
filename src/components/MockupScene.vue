<script setup lang="ts">
import { ref, shallowRef, watchEffect, watch, computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { ContactShadows } from '@tresjs/cientos'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { EffectComposerPmndrs, BloomPmndrs } from '@tresjs/post-processing'
import { useViewportScale } from '../composables/useViewportScale'
import { FERAL_GRADIENTS } from '../constants/gradients'
import { evaluateKeyframes } from '../utils/interpolator'
import type { Project3DConfig, TextureTransform, ScreenFitMode } from '../utils/types'

const props = defineProps<{
  config: Project3DConfig
  overrides?: Record<string, unknown>
  currentFrame: number
}>()

const isMobile =
  typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const baseW = computed(() => props.config.output.width)
const baseH = computed(() => props.config.output.height)
const { containerStyle } = useViewportScale(baseW, baseH, 1.0)
const pixelRatio = isMobile ? 1 : Math.min(window?.devicePixelRatio ?? 1, 2)

const bgTexture = shallowRef<THREE.CanvasTexture>()

function generateBackgroundTexture() {
  const bgCanvas = document.createElement('canvas')
  bgCanvas.width = 1024
  bgCanvas.height = 1024

  const ctx = bgCanvas.getContext('2d')
  if (!ctx) return

  const bgVal =
    (props.overrides?.background as string) ??
    props.config.variables?.backgroundGradient ??
    props.config.variables?.backgroundColor ??
    'iridescent-cloud'

  const preset = FERAL_GRADIENTS.find((g) => g.id === bgVal)

  if (preset) {
    ctx.fillStyle = preset.baseColor
    ctx.fillRect(0, 0, 1024, 1024)
    for (const spot of preset.spots) {
      const cx = 1024 * spot.x
      const cy = 1024 * spot.y
      const r = 1024 * spot.r
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0, spot.color)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1024, 1024)
    }
  } else {
    ctx.fillStyle = bgVal
    ctx.fillRect(0, 0, 1024, 1024)
  }

  const tex = new THREE.CanvasTexture(bgCanvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  bgTexture.value = tex
}

function createDefaultTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 2
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, 2, 2)
  }
  return new THREE.CanvasTexture(canvas)
}

const textureCache = new Map<string, THREE.Texture>()

async function loadAndClampImage(
  url: string,
  fit: ScreenFitMode,
  targetAspect: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const maxDim = isMobile ? 1024 : 2048
      let canvasW = maxDim
      let canvasH = Math.round(maxDim / targetAspect)
      if (targetAspect < 1) {
        canvasH = maxDim
        canvasW = Math.round(maxDim * targetAspect)
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(2, canvasW)
      canvas.height = Math.max(2, canvasH)
      const ctx = canvas.getContext('2d')!

      if (fit === 'stretch') {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      } else if (fit === 'cover') {
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
        const w = img.width * scale
        const h = img.height * scale
        const x = (canvas.width - w) / 2
        const y = (canvas.height - h) / 2
        ctx.drawImage(img, x, y, w, h)
      } else {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const w = img.width * scale
        const h = img.height * scale
        const x = (canvas.width - w) / 2
        const y = (canvas.height - h) / 2
        ctx.drawImage(img, x, y, w, h)
      }
      resolve(canvas)
    }
    img.onerror = reject
    img.src = url
  })
}

const loadCachedTexture = async (
  url?: string,
  fit: ScreenFitMode = 'cover',
  targetAspect = 16 / 10,
): Promise<THREE.Texture> => {
  if (!url) return createDefaultTexture()
  const cacheKey = `${url}:${fit}:${targetAspect.toFixed(2)}`
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey)!
  try {
    const clampedCanvas = await loadAndClampImage(url, fit, targetAspect)
    const tex = new THREE.CanvasTexture(clampedCanvas)
    tex.colorSpace = THREE.SRGBColorSpace
    textureCache.set(cacheKey, tex)
    return tex
  } catch {
    return createDefaultTexture()
  }
}

function applyTextureTransform(
  sourceTex: THREE.Texture,
  transformConfig?: TextureTransform,
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

  tex.anisotropy = isMobile ? 2 : 16
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

const cameraRef = shallowRef<THREE.PerspectiveCamera>()
const cameraPosition = ref<[number, number, number]>([0, 0, 4.2])
const cameraRotation = ref<[number, number, number]>([0, 0, 0])

const hasCameraRotation = computed(() => !!props.config.camera?.keyframes?.rotation)
const objectsConfig = computed(() => props.config.objects ?? [])

const activeScreenMedia = computed(
  () => ((props.overrides?.screenMedia ?? props.config.variables?.screenMedia) as string) ?? '',
)

const activeScreenFit = computed(
  () => (props.overrides?.screenFit as ScreenFitMode | undefined) ?? 'cover',
)

generateBackgroundTexture()

const gltfLoader = new GLTFLoader()
const modelCache = new Map<string, THREE.Group>()

const loadCachedModel = async (url: string) => {
  if (modelCache.has(url)) return modelCache.get(url)!
  const gltf = await gltfLoader.loadAsync(url)
  modelCache.set(url, gltf.scene)
  return gltf.scene
}

const sceneInstances = shallowRef<
  { group: THREE.Group; initialTransforms: Map<string, unknown> }[]
>([])
const screenEntries = shallowRef<
  { mat: THREE.MeshStandardMaterial; transform?: TextureTransform; aspect: number }[]
>([])
const chassisMaterials = shallowRef<THREE.MeshStandardMaterial[]>([])
const objectPositions = ref<[number, number, number][]>([])
const objectRotations = ref<[number, number, number][]>([])

function getScreenAspect(mesh: THREE.Mesh): number {
  const geo = mesh.geometry
  if (!geo.attributes.position || !geo.attributes.uv) return 16 / 10
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  const idx = geo.index
  const tris = Math.min(idx ? idx.count / 3 : pos.count / 3, 20)
  let uDist = 0,
    vDist = 0,
    count = 0
  const pA = new THREE.Vector3(),
    pB = new THREE.Vector3(),
    pC = new THREE.Vector3()
  const uvA = new THREE.Vector2(),
    uvB = new THREE.Vector2(),
    uvC = new THREE.Vector2()
  for (let i = 0; i < tris; i++) {
    const iA = idx ? idx.getX(i * 3) : i * 3
    const iB = idx ? idx.getX(i * 3 + 1) : i * 3 + 1
    const iC = idx ? idx.getX(i * 3 + 2) : i * 3 + 2
    pA.fromBufferAttribute(pos, iA)
    pB.fromBufferAttribute(pos, iB)
    pC.fromBufferAttribute(pos, iC)
    uvA.fromBufferAttribute(uv, iA)
    uvB.fromBufferAttribute(uv, iB)
    uvC.fromBufferAttribute(uv, iC)
    const du1 = uvB.x - uvA.x,
      dv1 = uvB.y - uvA.y
    const du2 = uvC.x - uvA.x,
      dv2 = uvC.y - uvA.y
    const det = du1 * dv2 - du2 * dv1
    if (Math.abs(det) > 1e-4) {
      const dp1 = new THREE.Vector3().subVectors(pB, pA)
      const dp2 = new THREE.Vector3().subVectors(pC, pA)
      uDist += new THREE.Vector3()
        .copy(dp1)
        .multiplyScalar(dv2)
        .sub(dp2.clone().multiplyScalar(dv1))
        .divideScalar(det)
        .length()
      vDist += new THREE.Vector3()
        .copy(dp2)
        .multiplyScalar(du1)
        .sub(dp1.clone().multiplyScalar(du2))
        .divideScalar(det)
        .length()
      count++
    }
  }
  if (count > 0 && vDist > 0) return uDist / vDist
  if (!geo.boundingBox) geo.computeBoundingBox()
  const s = geo.boundingBox!.getSize(new THREE.Vector3())
  const sorted = [s.x, s.y, s.z].sort((a, b) => b - a)
  return (sorted[0] ?? 16) / (sorted[1] ?? 10)
}

const instancesTemp = []
const screenEntriesTemp: {
  mat: THREE.MeshStandardMaterial
  transform?: TextureTransform
  aspect: number
}[] = []
const chassisMatsTemp: THREE.MeshStandardMaterial[] = []
const positionsTemp = []
const rotationsTemp = []

for (let i = 0; i < objectsConfig.value.length; i++) {
  const objConf = objectsConfig.value[i]!
  const baseScene = await loadCachedModel(objConf.modelUrl)
  const scene = SkeletonUtils.clone(baseScene) as THREE.Group

  const box = new THREE.Box3().setFromObject(scene)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  const autoCenter = objConf.autoCenter ?? true
  const autoScale = objConf.autoScale ?? true
  const customScale = typeof objConf.scale === 'number' ? objConf.scale : 1.0
  const targetScale = (autoScale ? 2.4 / (maxDim || 1) : 1.0) * customScale

  if (autoCenter) {
    scene.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale)
  }
  scene.scale.setScalar(targetScale)

  const wrapperGroup = new THREE.Group()
  wrapperGroup.add(scene)

  const targetMedia = objConf.screenMedia ?? activeScreenMedia.value
  const uvTransform = objConf.screenTransform ?? props.config.variables?.screenTransform

  const initialTransforms = new Map()
  const targetScreen = objConf.meshBindings?.screen
  const targetChassis = objConf.meshBindings?.chassis
  const chassisColor =
    (props.overrides?.chassisColor as string) ?? props.config.variables?.chassisColor ?? '#242426'

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
        const aspect = getScreenAspect(mesh)
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0x000000),
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: objConf.materials?.screen?.emissiveIntensity ?? 1.2,
          roughness: objConf.materials?.screen?.roughness ?? 0.05,
          metalness: 0.0,
        })
        loadCachedTexture(targetMedia, activeScreenFit.value, aspect).then((baseTex) => {
          mat.emissiveMap = applyTextureTransform(baseTex, uvTransform)
          mat.needsUpdate = true
        })
        mesh.material = mat
        screenEntriesTemp.push({ mat, transform: uvTransform, aspect })
      } else if (isChassis) {
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(chassisColor),
          metalness: objConf.materials?.chassis?.metalness ?? 0.85,
          roughness: objConf.materials?.chassis?.roughness ?? 0.25,
        })
        mesh.material = mat
        chassisMatsTemp.push(mat)
      }
    }
  })

  instancesTemp.push({ group: wrapperGroup, initialTransforms })
  positionsTemp.push([0, 0, 0])
  rotationsTemp.push([0, 0, 0])
}

screenEntries.value = screenEntriesTemp
chassisMaterials.value = chassisMatsTemp
sceneInstances.value = instancesTemp
objectPositions.value = positionsTemp as [number, number, number][]
objectRotations.value = rotationsTemp as [number, number, number][]

async function updateScreenTextures() {
  const media = activeScreenMedia.value
  if (!media) return
  for (const entry of screenEntries.value) {
    const baseTex = await loadCachedTexture(media, activeScreenFit.value, entry.aspect)
    entry.mat.emissiveMap = applyTextureTransform(baseTex, entry.transform)
    entry.mat.needsUpdate = true
  }
}

watch([activeScreenMedia, activeScreenFit], updateScreenTextures)

watch(
  () => props.overrides?.chassisColor,
  (newColor) => {
    if (!newColor) return
    chassisMaterials.value.forEach((mat) => {
      mat.color.set(newColor as string)
    })
  },
)

watch(() => props.overrides?.background, generateBackgroundTexture)

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

  objectsConfig.value.forEach((objConf, i: number) => {
    const pos = evaluateKeyframes(objConf.keyframes?.position, frame)
    const rot = evaluateKeyframes(objConf.keyframes?.rotation, frame)

    if (pos && pos.length === 3) objectPositions.value[i] = [pos[0]!, pos[1]!, pos[2]!]
    if (rot && rot.length === 3) objectRotations.value[i] = [rot[0]!, rot[1]!, rot[2]!]

    const nodeKeyframes = objConf.keyframes?.nodes
    const instanceData = sceneInstances.value[i]
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

const bloomConfig = computed(() => ({
  intensity: props.config.postProcessing?.bloom?.intensity ?? 0.3,
  luminanceThreshold: props.config.postProcessing?.bloom?.luminanceThreshold ?? 0.95,
  luminanceSmoothing: props.config.postProcessing?.bloom?.luminanceSmoothing ?? 0.2,
  mipmapBlur: props.config.postProcessing?.bloom?.mipmapBlur ?? true,
}))

const ambientLight = computed(() => ({
  intensity: props.config.lights?.ambient?.intensity ?? 1.0,
  color: props.config.lights?.ambient?.color ?? '#ffffff',
}))

const directionalLights = computed(() => {
  return (
    props.config.lights?.directional || [
      { position: [4, 6, 3], intensity: 1.8, color: '#ffffff' },
      { position: [-4, -3, -2], intensity: 0.6, color: '#ffffff' },
    ]
  )
})

const pointLights = computed(() => props.config.lights?.point || [])

const contactShadowsConfig = computed(() => {
  const raw = props.config.contactShadows
  if (!raw) return null

  const cfg = typeof raw === 'boolean' ? {} : raw
  if (cfg.position && cfg.scale) return cfg

  if (sceneInstances.value.length === 0) return null

  let minY = Infinity
  let minX = Infinity,
    maxX = -Infinity
  let minZ = Infinity,
    maxZ = -Infinity

  sceneInstances.value.forEach((inst, i) => {
    const pos = objectPositions.value[i] || [0, 0, 0]
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
    resolution: isMobile ? 256 : (cfg.resolution ?? 512),
  }
})

const elementsConfig = computed(() => props.config.elements || [])
</script>

<template>
  <div class="absolute top-1/2 left-1/2 origin-center overflow-hidden" :style="containerStyle">
    <TresCanvas
      :pixel-ratio="pixelRatio"
      :output-color-space="THREE.SRGBColorSpace"
      :gl="{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }"
    >
      <primitive v-if="bgTexture" :object="bgTexture" attach="background" />

      <TresPerspectiveCamera
        v-if="hasCameraRotation"
        ref="cameraRef"
        :position="cameraPosition"
        :rotation="cameraRotation"
        :aspect="baseW / baseH"
        :fov="config.camera?.fov ?? 34"
      />

      <TresPerspectiveCamera
        v-else
        ref="cameraRef"
        :position="cameraPosition"
        :look-at="config.camera?.lookAt ?? [0, 0, 0]"
        :aspect="baseW / baseH"
        :fov="config.camera?.fov ?? 34"
      />

      <TresAmbientLight :intensity="ambientLight.intensity" :color="ambientLight.color" />

      <TresDirectionalLight
        v-for="(light, idx) in directionalLights"
        :key="`dir-${idx}`"
        :position="light.position"
        :intensity="light.intensity"
        :color="light.color || '#ffffff'"
      />

      <TresPointLight
        v-for="(light, idx) in pointLights"
        :key="`pt-${idx}`"
        :position="light.position"
        :intensity="light.intensity"
        :color="light.color || '#ffffff'"
        :distance="light.distance || 0"
        :decay="light.decay ?? 2"
      />

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

      <primitive
        v-for="(instance, index) in sceneInstances"
        :key="`obj-${index}`"
        :object="instance.group"
        :position="objectPositions[index]"
        :rotation="objectRotations[index]"
      />

      <EffectComposerPmndrs v-if="!isMobile" :multisampling="4">
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