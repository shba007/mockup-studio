<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MockupScene from './components/MockupScene.vue';
import defaultTemplate from '../templates/iphone-orbit.json';

const config = ref(defaultTemplate);
const overrides = ref({});
const isReady = ref(false);

onMounted(() => {
  // Read setup payload injected via window parameter
  const globalPayload = (window as any).__RENDER_PAYLOAD__;
  if (globalPayload) {
    if (globalPayload.template) config.value = globalPayload.template;
    if (globalPayload.overrides) overrides.value = globalPayload.overrides;
  }
  isReady.value = true;
});
</script>

<template>
  <Suspense>
    <MockupScene v-if="isReady" :config="config" :overrides="overrides" />
    <template #fallback>
      <div>Loading 3D Engine...</div>
    </template>
  </Suspense>
</template>
