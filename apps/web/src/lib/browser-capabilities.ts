export interface CanvasProbe {
  getContext(
    contextId: "webgl2",
    options?: WebGLContextAttributes,
  ): unknown;
}

export function supportsWebGl2(canvas: CanvasProbe): boolean {
  try {
    return canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
      stencil: false,
    }) !== null;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(mediaQuery: Pick<MediaQueryList, "matches">): boolean {
  return mediaQuery.matches;
}
