/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // Replace the {} with Record<string, unknown>
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
