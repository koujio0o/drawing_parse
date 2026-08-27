import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PerspectiveCamera, Object3D } from 'three';

/**
 * Options for the usePerspectiveCamera hook.
 */
export interface UsePerspectiveCameraOptions {
  /** Base Z distance used in the camera-Z calculation. */
  baseZ: number;
  /** Initial field-of-view in degrees. @default 80 */
  initialFov?: number;
  /** Allowed FOV range as `[min, max]`. @default [50, 150] */
  fovRange?: [number, number];
  /** Initial X-axis rotation in degrees. @default 25 */
  initialRx?: number;
  /** Initial Y-axis rotation in degrees. @default 45 */
  initialRy?: number;
  /** Initial zoom multiplier. @default 1.0 */
  initialZoom?: number;
  /** Callback invoked after any value update (to trigger a render). */
  onRender: () => void;
}

/**
 * Return value of the usePerspectiveCamera hook.
 */
export interface PerspectiveCameraHandle {
  /** Current FOV (React state, for UI binding). */
  fov: number;
  /** Current X rotation in degrees (React state, for UI binding). */
  rx: number;
  /** Current Y rotation in degrees (React state, for UI binding). */
  ry: number;
  /** Synchronous ref holding `{ fov, rx, ry, zoom }` for render-loop access. */
  sr: MutableRefObject<{ fov: number; rx: number; ry: number; zoom: number }>;
  /** Update FOV, sync ref + state, then call onRender. */
  setFovSync: (v: number) => void;
  /** Update rx, sync ref + state, then call onRender. */
  setRxSync: (v: number) => void;
  /** Update ry, sync ref + state, then call onRender. */
  setRySync: (v: number) => void;
  /** Update zoom (value or functional updater), sync ref, then call onRender. */
  setZoomSync: (v: number | ((z: number) => number)) => void;
  /** Allowed FOV range. */
  fovRange: [number, number];
  /** Calculate the camera Z position from current FOV and zoom. */
  calcCameraZ: () => number;
  /** Apply FOV and position.z to camera(s), then update projection matrices. */
  applyToCamera: (camera: PerspectiveCamera, thumbnailCamera?: PerspectiveCamera) => void;
  /** Apply rx/ry rotation to a group and update its world matrix. */
  applyRotation: (group: Object3D) => void;
}

/**
 * Manages perspective camera state (FOV, rotation, zoom) with
 * synchronous refs suitable for 60 fps WebGL render loops.
 *
 * React state is maintained in parallel for UI binding (sliders, etc.),
 * while `sr.current` provides instant, non-batched access inside
 * `requestAnimationFrame` callbacks.
 *
 * @example
 * ```tsx
 * const cam = usePerspectiveCamera({
 *   baseZ: 500,
 *   onRender: () => rendererRef.current?.render(scene, camera),
 * });
 * ```
 */
function usePerspectiveCamera(options: UsePerspectiveCameraOptions): PerspectiveCameraHandle {
  const {
    baseZ,
    initialFov = 80,
    fovRange: fovRangeOpt = [50, 150] as [number, number],
    initialRx = 25,
    initialRy = 45,
    initialZoom = 1.0,
    onRender,
  } = options;

  // --- React state (for UI binding) ---
  const [fov, setFov] = useState(() => {
    const saved = localStorage.getItem('globalFov');
    return saved ? parseInt(saved, 10) : initialFov;
  });
  const [rx, setRx] = useState(initialRx);
  const [ry, setRy] = useState(initialRy);

  // --- Synchronous ref for render loops ---
  const sr = useRef({ fov, rx: initialRx, ry: initialRy, zoom: initialZoom });

  // Stable ref for onRender so callbacks don't need it as a dep
  const onRenderRef = useRef(onRender);
  onRenderRef.current = onRender;

  // Stable ref for baseZ
  const baseZRef = useRef(baseZ);
  baseZRef.current = baseZ;

  // --- Sync setters ---

  /** Update FOV in both React state and the synchronous ref, then trigger a render. */
  const setFovSync = useCallback((v: number) => {
    sr.current.fov = v;
    setFov(v);
    localStorage.setItem('globalFov', v.toString());
    onRenderRef.current();
  }, []);

  /** Update rx in both React state and the synchronous ref, then trigger a render. */
  const setRxSync = useCallback((v: number) => {
    sr.current.rx = v;
    setRx(v);
    onRenderRef.current();
  }, []);

  /** Update ry in both React state and the synchronous ref, then trigger a render. */
  const setRySync = useCallback((v: number) => {
    sr.current.ry = v;
    setRy(v);
    onRenderRef.current();
  }, []);

  /**
   * Update zoom in the synchronous ref, then trigger a render.
   * Supports both direct values and functional updaters.
   * Zoom is ref-only (no React state) since no UI displays it.
   */
  const setZoomSync = useCallback((v: number | ((z: number) => number)) => {
    const newZoom = typeof v === 'function' ? v(sr.current.zoom) : v;
    sr.current.zoom = newZoom;
    onRenderRef.current();
  }, []);

  // --- Derived helpers ---

  /**
   * Calculate the camera Z position based on the current FOV and zoom.
   *
   * Formula: `baseZ / tan((fov * π / 180) / 2) / zoom`
   */
  const calcCameraZ = useCallback((): number => {
    const { fov: f, zoom: z } = sr.current;
    return baseZRef.current / Math.tan(((f * Math.PI) / 180) / 2) / z;
  }, []);

  /**
   * Apply the current FOV and calculated Z position to one or two
   * PerspectiveCamera instances, then update their projection matrices.
   */
  const applyToCamera = useCallback(
    (camera: PerspectiveCamera, thumbnailCamera?: PerspectiveCamera): void => {
      const f = sr.current.fov;
      const z = baseZRef.current / Math.tan(((f * Math.PI) / 180) / 2) / sr.current.zoom;

      camera.fov = f;
      camera.position.z = z;
      camera.updateProjectionMatrix();

      if (thumbnailCamera) {
        thumbnailCamera.fov = f;
        thumbnailCamera.position.z = z;
        thumbnailCamera.updateProjectionMatrix();
      }
    },
    [],
  );

  /**
   * Apply the current rx/ry rotation (in degrees) to a THREE.Object3D group
   * and force a world-matrix update.
   */
  const applyRotation = useCallback((group: Object3D): void => {
    const { rx: x, ry: y } = sr.current;
    group.rotation.set((x * Math.PI) / 180, (y * Math.PI) / 180, 0);
    group.updateMatrixWorld(true);
  }, []);

  return {
    fov,
    rx,
    ry,
    sr,
    setFovSync,
    setRxSync,
    setRySync,
    setZoomSync,
    fovRange: fovRangeOpt,
    calcCameraZ,
    applyToCamera,
    applyRotation,
  };
}

export default usePerspectiveCamera;
