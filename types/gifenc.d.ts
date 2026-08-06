/**
 * Types for `gifenc`, which ships none.
 *
 * Written against the package's own source (node_modules/gifenc/src) rather
 * than declared as `any`. A blanket `declare module 'gifenc'` would silence the
 * compiler and take the encoder's whole surface out of typechecking — the
 * argument order of writeFrame(index, width, height) is exactly the kind of
 * thing that then goes wrong silently and produces a corrupt file.
 *
 * Only what lib/freehold/gif-encode.ts uses is declared.
 */
declare module 'gifenc' {
  /** A flat RGB(A) palette: one [r,g,b] or [r,g,b,a] triple per colour. */
  export type Palette = number[][]

  export interface WriteFrameOptions {
    /** Milliseconds this frame is held. */
    delay?: number
    /** Local colour table for this frame. */
    palette?: Palette | null
    /** 0 = loop forever, -1 = play once, >0 = that many times. */
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    colorDepth?: number
    dispose?: number
  }

  export interface GIFEncoderInstance {
    /** `index` is one palette index per pixel, row-major. */
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void
    /** Write the GIF trailer. Call once, after the last frame. */
    finish(): void
    /** The finished file. */
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
    readonly buffer: ArrayBuffer
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance

  /** Reduce RGBA pixel data to at most `maxColors` colours. */
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): Palette

  /** Map RGBA pixel data onto a palette, returning one index per pixel. */
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array

  /**
   * The package has no `exports` map: `main` is CJS and `module` is ESM. A
   * bundler resolves the ESM build and gets named exports; Node's own loader
   * takes `main` and cannot see them, so anything running under plain Node
   * (the guard scripts) must come through the default object.
   */
  const gifenc: {
    GIFEncoder: typeof GIFEncoder
    quantize: typeof quantize
    applyPalette: typeof applyPalette
  }
  export default gifenc
}
