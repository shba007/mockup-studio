# Mockup Renderer

# General Guidelines for Writing `animation.json`

An `animation.json` configuration file controls everything about your 3D scene: canvas output parameters, global assets/variables, core 3D model path and mesh binding targets, camera behavior, and complex node-level keyframe hierarchies.

---

### 1. Output & Timeline Structure (`output`)

Defines the rendering resolution, frame rate, and total duration of the sequence.

- **`width` / `height**`: Render resolution in pixels (e.g., `1080` x `1920` for vertical formats or `1920` x `1080` for horizontal).

- **`fps`**: Target frames per second. Typically locked to `60` for buttery-smooth motion graphics.

- **`durationFrames`**: Total length of the animation in frames. Calculated as `FPS * total_seconds` (e.g., a 7.5-second video at 60fps = `450` frames).

---

### 2. Variables & Assets (`variables`)

Stores dynamic assets and styling parameters that can be overridden by external scripts or web UI controls.

- **`screenMedia`**: Path to the texture/image applied to the device display screen (e.g., `"/assets/textures/preview-1.jpg"`).

- **`chassisColor`**: Hex code defining the metallic/matte finish of the device body (e.g., `"#535150"`).

- **`backgroundGradient`**: CSS or procedural gradient strings used to map textures into the 3D scene background.

---

### 3. Device Bindings & Materials (`device`)

Maps your configuration to the physical GLB model nodes and fine-tunes material properties.

- **`modelUrl`**: Relative path to the 3D asset (`.glb` or `.gltf`).

- **`meshBindings`**: Identifies specific parts of the 3D model using unique mesh names, material IDs, or internal map tags (e.g., targeting `"screen"` and `"chassis"`).

- **`materials`**: Configures physical shader properties like `metalness`, `roughness`, and `emissiveIntensity`. To prevent ambient light washout on screens, combine a pitch-black base color with a 100% emissive map.

---

### 4. Keyframe Architecture (`keyframes`)

Keyframes dictate how parameters change over time. Every keyframe object requires a `frame` index, a numerical `value` array, and an optional `easing` function string.

#### Supported Easing Functions:

- `linear`

- `easeOutCubic` / `easeInCubic` / `easeInOutCubic`

- `easeOutQuad` / `easeInOutQuad`

- `easeOutExpo`

- `easeInOutSine` (Ideal for smooth mechanical pivots like hinges)

#### Track Types:

1. **`position` (`[X, Y, Z]`):** Moves the root model across space. (Use larger negative Y values like `-4.5` for off-screen slide-ups).
2. **`rotation` (`[X, Y, Z]` in radians):** Rotates the entire object. Keep in mind that full $360^\circ$ spins require values up to $\pm 6.283$ or $9.424$ radians.
3. **`camera.position` (`[X, Y, Z]`):** Adjusts the distance and perspective frame of the lens. Zooming out slightly during fast movements prevents clipping.
4. **`nodes` (Sub-Component Animation):** Controls moving parts _within_ the model (like laptop hinges or folding mechanisms).

- _Rule of Thumb:_ Always target the **highest-level parent group** of a moving piece in the GLB hierarchy to ensure the pivot point aligns naturally.
- _Rule of Thumb:_ Treat node animations as **relative offsets** so they build on top of the model's native baked-in resting state rather than snapping to absolute world coordinates.

---

### Standard Template Blueprint

```json
{
  "id": "project-identifier",
  "output": {
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "durationFrames": 300
  },
  "variables": {
    "screenMedia": "/assets/textures/your-screen.jpg",
    "chassisColor": "#242426",
    "backgroundGradient": "radial-gradient(circle at center, #5945EA 0%, #2B2B2B 100%)"
  },
  "device": {
    "modelUrl": "/assets/models/device.glb",
    "meshBindings": {
      "screen": "YOUR_SCREEN_ID",
      "chassis": "YOUR_CHASSIS_ID"
    },
    "materials": {
      "chassis": { "metalness": 0.85, "roughness": 0.25 },
      "screen": { "roughness": 0.1 }
    },
    "keyframes": {
      "position": [
        { "frame": 0, "value": [0, -4.0, 0], "easing": "easeOutCubic" },
        { "frame": 60, "value": [0, 0, 0] }
      ],
      "rotation": [
        { "frame": 0, "value": [0.2, 0, 0], "easing": "easeOutCubic" },
        { "frame": 60, "value": [0, 0, 0] }
      ],
      "nodes": {
        "PARENT_HINGE_NODE_ID": {
          "rotation": [
            { "frame": 0, "value": [1.57, 0, 0], "easing": "easeInOutSine" },
            { "frame": 60, "value": [0, 0, 0] }
          ]
        }
      }
    }
  },
  "camera": {
    "fov": 34,
    "keyframes": {
      "position": [
        { "frame": 0, "value": [0, 0, 5.0], "easing": "easeOutCubic" },
        { "frame": 60, "value": [0, 0, 4.0] }
      ]
    }
  }
}
```
