<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { evaluateKeyframes } from '../utils/interpolator';

const props = defineProps<{
  config: any;
  overrides: {
    screenMedia?: string;
    chassisColor?: string;
    backgroundColor?: string;
  };
}>();

const cameraRef = shallowRef<THREE.PerspectiveCamera>();
const devicePosition = ref<[number, number, number]>([0, 0, 0]);
const deviceRotation = ref<[number, number, number]>([0, 0, 0]);
const cameraPosition = ref<[number, number, number]>([0, 0, 4.2]);

const activeScreenMedia = props.overrides?.screenMedia || props.config.variables?.screenMedia;
const activeChassisColor = props.overrides?.chassisColor || props.config.variables?.chassisColor || '#242426';
const activeBgColor = props.overrides?.backgroundColor || props.config.variables?.backgroundColor || '#0d0f12';

const durationFrames = props.config.output?.durationFrames || 120;
const fps = props.config.output?.fps || 60;
const isLivePlayback = ref(true);
const currentFrame = ref(0);
let animationFrameId: number | null = null;
let lastTimestamp = 0;

// 1. Procedural High-Res Screen Fallback
function createFallbackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1179;
  canvas.height = 2556;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(1, '#06b6d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('App Screen Preview', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = '40px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('Drop your screenshot here', canvas.width / 2, canvas.height / 2 + 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 2. Load Screen Texture
let screenTexture: THREE.Texture;
if (activeScreenMedia) {
  try {
    const texLoader = new THREE.TextureLoader();
    screenTexture = await texLoader.loadAsync(activeScreenMedia);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.flipY = false;
  } catch {
    screenTexture = createFallbackTexture();
  }
} else {
  screenTexture = createFallbackTexture();
}

// 3. Load & Auto-Normalize 3D Model
const rootGroup = shallowRef<THREE.Group>(new THREE.Group());
const gltfLoader = new GLTFLoader();
const gltf = await gltfLoader.loadAsync(props.config.device.modelUrl);
const loadedScene = gltf.scene;

const box = new THREE.Box3().setFromObject(loadedScene);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());

const maxDim = Math.max(size.x, size.y, size.z);
const targetScale = 2.4 / (maxDim || 1);

loadedScene.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale);
loadedScene.scale.setScalar(targetScale);
rootGroup.value.add(loadedScene);

// 4. Traverse and Apply Materials
const targetScreen = props.config.device.meshBindings?.screen;
const targetChassis = props.config.device.meshBindings?.chassis;

loadedScene.traverse((child: any) => {
  if (child.isMesh) {
    const matName = child.material?.name || '';
    const nodeName = child.name || '';

    if (nodeName === targetScreen || matName === targetScreen) {
      child.material = new THREE.MeshStandardMaterial({
        map: screenTexture,
        roughness: props.config.device.materials?.screen?.roughness ?? 0.1,
        metalness: 0.0,
      });
    }

    if (nodeName === targetChassis || matName === targetChassis) {
      child.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(activeChassisColor),
        metalness: props.config.device.materials?.chassis?.metalness ?? 0.85,
        roughness: props.config.device.materials?.chassis?.roughness ?? 0.25,
      });
    }
  }
});

// 5. Deterministic Keyframe Update
function applyFrame(frame: number) {
  const pos = evaluateKeyframes(props.config.device.keyframes.position, frame);
  const rot = evaluateKeyframes(props.config.device.keyframes.rotation, frame);
  const cam = evaluateKeyframes(props.config.camera.keyframes.position, frame);

  devicePosition.value = [pos[0], pos[1], pos[2]];
  deviceRotation.value = [rot[0], rot[1], rot[2]];
  cameraPosition.value = [cam[0], cam[1], cam[2]];
}

// 6. Native requestAnimationFrame Loop
function loop(timestamp: number) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  if (isLivePlayback.value) {
    currentFrame.value = (currentFrame.value + delta * fps) % durationFrames;
    applyFrame(currentFrame.value);
  }

  animationFrameId = requestAnimationFrame(loop);
}

onMounted(() => {
  (window as any).__SEEK_FRAME__ = (frame: number) => {
    isLivePlayback.value = false;
    currentFrame.value = frame;
    applyFrame(frame);
  };

  applyFrame(0);
  animationFrameId = requestAnimationFrame(loop);
});

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<template>
  <div :style="{ width: '100vw', height: '100vh', backgroundColor: activeBgColor }">
    <TresCanvas :clear-alpha="0">
      <TresPerspectiveCamera ref="cameraRef" :position="cameraPosition" :fov="config.camera.fov || 35"
        :look-at="[0, 0, 0]" />
      <TresAmbientLight :intensity="1.8" />
      <TresDirectionalLight :position="[4, 6, 3]" :intensity="3.0" />
      <TresDirectionalLight :position="[-4, -3, -2]" :intensity="1.2" />

      <primitive :object="rootGroup" :position="devicePosition" :rotation="deviceRotation" />
    </TresCanvas>
  </div>
</template>
