# Mockup Renderer

# Comprehensive Guide to Writing `animation.json`

An `animation.json` file dictates the timeline, output resolution, visual styling, 3D mesh bindings, and keyframed choreography for your scenes.

---

### 1. Structural Overview

Every configuration file should be partitioned into four primary blocks:

1. **`output`**: Defines frame rates, resolution, and total duration.
2. **`variables`**: Global design settings (background gradients, chassis colors, default media textures).
3. **`device`**: Model path, unique mesh/node IDs, materials, and internal keyframe animations.
4. **`camera`**: Field of view (FOV) and cinematic camera movements.

---

### 2. Output & Timing Architecture

- **Frame Rate (`fps`)**: Always target `60` for buttery-smooth motion graphics.
- **Duration (`durationFrames`)**: Calculate total time by multiplying seconds by FPS (e.g., 7.5 seconds $\times$ 60 FPS = `450` frames).
- **Pacing Breakdown**:
- _Intro/Entrance:_ First 15% to 20% of frames (e.g., frames 0–75).
- _Hero Still Hold:_ 60% to 70% of frames where the product rests completely static for readability.
- _Outro/Exit:_ Final 15% to 20% of frames.

---

### 3. Mesh & Node Identification (The Hierarchy Rule)

To avoid objects breaking, floating away, or separating from their assemblies (like a MacBook hinge dropping away from the screen):

- **Root Transformations (`device.keyframes.position/rotation`)**: Use these _only_ for moving the entire product as a single unit across the global viewport.
- **Sub-Node Transformations (`device.keyframes.nodes`)**: Use these for articulating moving parts (lids, camera modules, folding mechanisms).
- **The Pivot Rule**: Always target the **highest-level parent group node** in the GLTF tree that contains the assembly. Targeting a low-level child mesh (like a tiny hinge cover) will result in offset pivot points and broken geometry.

---

### 4. Additive Kinematics (Relative vs. Absolute)

When writing node animations (e.g., opening a laptop lid):

- **Never use absolute resets** that overwrite the 3D modeler's baked-in rest coordinates unless you want the piece to snap to the world origin.
- **Design Additive Keyframes**: Write keyframe values as _offsets_ relative to the model's resting state. For instance, if a lid starts closed at a specific radian angle, animate from that offset angle to `[0, 0, 0]` to open it naturally.

---

### 5. Easing & Interpolation Control

To make mechanical movements feel weighty and professional rather than robotic:

- **`easeOutCubic` / `easeOutExpo**`: Perfect for smooth, luxurious decelerations as an object slides into view.
- **`easeInOutCubic`**: Ideal for seamless middle-ground transitions or loops.
- **`linear`**: Use _only_ during static holds or constant continuous spins to prevent unwanted acceleration artifacts.

---

### 6. Template Reference Schema

```json
{
  "id": "product-showcase-template",
  "output": {
    "width": 1080,
    "height": 1920,
    "fps": 60,
    "durationFrames": 300
  },
  "variables": {
    "screenMedia": "/assets/textures/app-screen.png",
    "chassisColor": "#242426",
    "backgroundGradient": "radial-gradient(circle at center, #5945EA 0%, #2B2B2B 100%)"
  },
  "device": {
    "modelUrl": "/assets/models/product.glb",
    "meshBindings": {
      "screen": "UniqueScreenMeshId_Or_MaterialName",
      "chassis": "UniqueChassisMeshId_Or_MaterialName"
    },
    "materials": {
      "chassis": {
        "metalness": 0.85,
        "roughness": 0.25
      },
      "screen": {
        "roughness": 0.1,
        "emissiveIntensity": 1.0
      }
    },
    "keyframes": {
      "position": [
        {
          "frame": 0,
          "value": [0, -3.0, 0],
          "easing": "easeOutCubic"
        },
        {
          "frame": 60,
          "value": [0, 0, 0],
          "easing": "linear"
        },
        {
          "frame": 240,
          "value": [0, 0, 0],
          "easing": "easeInOutCubic"
        },
        {
          "frame": 300,
          "value": [0, -3.0, 0]
        }
      ],
      "rotation": [
        {
          "frame": 0,
          "value": [0.2, -1.57, 0],
          "easing": "easeOutCubic"
        },
        {
          "frame": 60,
          "value": [0, 0, 0],
          "easing": "linear"
        },
        {
          "frame": 240,
          "value": [0, 0, 0],
          "easing": "easeInOutCubic"
        },
        {
          "frame": 300,
          "value": [-0.2, 1.57, 0]
        }
      ],
      "nodes": {
        "ParentGroupNodeId_FromGLTF": {
          "rotation": [
            {
              "frame": 0,
              "value": [1.57, 0, 0],
              "easing": "easeInOutSine"
            },
            {
              "frame": 60,
              "value": [0, 0, 0],
              "easing": "linear"
            }
          ]
        }
      }
    }
  },
  "camera": {
    "fov": 34,
    "keyframes": {
      "position": [
        {
          "frame": 0,
          "value": [0, 0, 5.0],
          "easing": "easeOutCubic"
        },
        {
          "frame": 60,
          "value": [0, 0, 4.0],
          "easing": "linear"
        },
        {
          "frame": 240,
          "value": [0, 0, 4.0],
          "easing": "easeInOutCubic"
        },
        {
          "frame": 300,
          "value": [0, 0, 5.0]
        }
      ]
    }
  }
}
```
