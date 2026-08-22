<script setup lang="ts">
import { ref, shallowRef, watchEffect } from 'vue';
import { TresCanvas } from '@tresjs/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { evaluateKeyframes } from '../utils/interpolator';

const props = defineProps<{
  config: Record<string, any>;
  overrides: Record<string, any>;
  currentFrame: number;
}>();

const cameraRef = shallowRef<THREE.PerspectiveCamera>();
const devicePosition = ref<[number, number, number]>([0, 0, 0]);
const deviceRotation = ref<[number, number, number]>([0, 0, 0]);
const cameraPosition = ref<[number, number, number]>([0, 0, 4.2]);

const activeScreenMedia = props.overrides?.screenMedia || props.config.variables?.screenMedia;
const activeChassisColor = props.overrides?.chassisColor || props.config.variables?.chassisColor || '#242426';
const activeBg = props.overrides?.backgroundColor || props.config.variables?.backgroundGradient || props.config.variables?.backgroundColor || '#0d0f12';

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

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

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

const targetScreen = props.config.device.meshBindings?.screen;
const targetChassis = props.config.device.meshBindings?.chassis;

loadedScene.traverse((child: THREE.Object3D) => {
  if ((child as THREE.Mesh).isMesh) {
    const mesh = child as THREE.Mesh;
    const material = mesh.material as THREE.Material;

    const matName = material?.name || '';
    const nodeName = mesh.name || '';

    if (nodeName === targetScreen || matName === targetScreen) {
      mesh.material = new THREE.MeshStandardMaterial({
        map: screenTexture,
        roughness: props.config.device.materials?.screen?.roughness ?? 0.1,
        metalness: 0.0,
      });
    }

    if (nodeName === targetChassis || matName === targetChassis) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(activeChassisColor),
        metalness: props.config.device.materials?.chassis?.metalness ?? 0.85,
        roughness: props.config.device.materials?.chassis?.roughness ?? 0.25,
      });
    }
  }
});

watchEffect(() => {
  const frame = props.currentFrame;
  const pos = evaluateKeyframes(props.config.device.keyframes.position, frame);
  const rot = evaluateKeyframes(props.config.device.keyframes.rotation, frame);
  const cam = evaluateKeyframes(props.config.camera.keyframes.position, frame);

  devicePosition.value = [pos[0], pos[1], pos[2]];
  deviceRotation.value = [rot[0], rot[1], rot[2]];
  cameraPosition.value = [cam[0], cam[1], cam[2]];
});
</script>

<template>
  <div class="scene-viewport" :style="{
    background: activeBg,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }">
    <TresCanvas :clear-alpha="0">
      <TresPerspectiveCamera ref="cameraRef" :position="cameraPosition" :fov="config.camera?.fov || 34"
        :look-at="[0, 0, 0]" />
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
