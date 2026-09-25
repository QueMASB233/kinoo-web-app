/**
 * Optimización de video de publicaciones en el navegador (WebCodecs vía Mediabunny).
 *
 * Acepta MP4 (H.264 o HEVC) y produce un MP4 H.264 cuadrado ≤ 720×720,
 * ~2 Mbps y fast start: ~8 MB para 30 s. Así el límite del servidor (50 MB)
 * no depende de cómo grabó el proveedor.
 */
import {
  PROMOTION_VIDEO_MAX_BYTES,
  PROMOTION_VIDEO_MAX_DURATION_SECONDS,
  PROMOTION_VIDEO_ONLY_MP4_MESSAGE,
  PROMOTION_VIDEO_SOURCE_MAX_BYTES,
  formatFileSizeMb,
  isMp4File,
  readVideoDurationSeconds,
  validatePromotionVideoFile,
} from "@/lib/promotion-video"
import type { VideoCodec, VideoSample } from "mediabunny"

const TARGET_MAX_SIDE = 720
const TARGET_VIDEO_BITRATE = 2_000_000
const TARGET_AUDIO_BITRATE = 128_000
const TARGET_MAX_FPS = 30

export interface PreparedPromotionVideo {
  file: File
  durationSeconds: number
  /** true si se re-codificó en el navegador; false si se usa el original. */
  optimized: boolean
  originalBytes: number
}

export class VideoPrepareCanceledError extends Error {
  constructor() {
    super("Optimización cancelada.")
    this.name = "VideoPrepareCanceledError"
  }
}

/** Error que no tiene sentido reintentar con el archivo original. */
class VideoPrepareFatalError extends Error {}

type Mediabunny = typeof import("mediabunny")

let mediabunnyPromise: Promise<Mediabunny> | null = null
let aacEncoderRegistered = false

function loadMediabunny(): Promise<Mediabunny> {
  mediabunnyPromise ??= import("mediabunny")
  return mediabunnyPromise
}

function hasWebCodecs(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.VideoEncoder !== "undefined" &&
    typeof window.VideoDecoder !== "undefined"
  )
}

async function ensureAacEncoder(mb: Mediabunny): Promise<void> {
  if (aacEncoderRegistered) return
  if (await mb.canEncodeAudio("aac")) {
    aacEncoderRegistered = true
    return
  }
  const { registerAacEncoder } = await import("@mediabunny/aac-encoder")
  registerAacEncoder()
  aacEncoderRegistered = true
}

type AvcEncoderOverride = {
  codec: string
  bitrateMode?: VideoEncoderConfig["bitrateMode"]
  hardwareAcceleration: NonNullable<VideoEncoderConfig["hardwareAcceleration"]>
}

/**
 * Mediabunny solo pide H.264 High + bitrate variable; algunos navegadores
 * (Safari) rechazan esa combinación exacta pero aceptan otras equivalentes.
 * Probamos High/Main/Constrained Baseline (niveles 3.1 y 4.0).
 */
const AVC_CODEC_CANDIDATES = [
  "avc1.64001f",
  "avc1.4d001f",
  "avc1.42e01f",
  "avc1.640028",
  "avc1.4d0028",
  "avc1.42e028",
]
const AVC_BITRATE_MODES: (VideoEncoderConfig["bitrateMode"] | undefined)[] = [
  "variable",
  "constant",
  undefined,
]
const AVC_HARDWARE_PREFERENCES: AvcEncoderOverride["hardwareAcceleration"][] = [
  "no-preference",
  "prefer-hardware",
  "prefer-software",
]
const AVC_FALLBACK_SIDES = [640, 480]

let avcEncoderOverride: AvcEncoderOverride | null = null
let nativeAvcEncoderRegistered = false

async function findSupportedAvcConfig(side: number): Promise<AvcEncoderOverride | null> {
  for (const codec of AVC_CODEC_CANDIDATES) {
    for (const bitrateMode of AVC_BITRATE_MODES) {
      for (const hardwareAcceleration of AVC_HARDWARE_PREFERENCES) {
        const config: VideoEncoderConfig = {
          codec,
          width: side,
          height: side,
          bitrate: TARGET_VIDEO_BITRATE,
          hardwareAcceleration,
          avc: { format: "avc" },
        }
        if (bitrateMode) config.bitrateMode = bitrateMode
        try {
          if ((await VideoEncoder.isConfigSupported(config)).supported) {
            return { codec, bitrateMode, hardwareAcceleration }
          }
        } catch {
          // Configuración no soportada; seguimos con la siguiente.
        }
      }
    }
  }
  return null
}

/** Encoder WebCodecs nativo con la configuración que el navegador sí aceptó. */
function installNativeAvcEncoder(mb: Mediabunny, override: AvcEncoderOverride): void {
  avcEncoderOverride = override
  if (nativeAvcEncoderRegistered) return

  class NativeAvcEncoder extends mb.CustomVideoEncoder {
    private encoder: VideoEncoder | null = null

    static override supports(codec: VideoCodec): boolean {
      return codec === "avc" && avcEncoderOverride !== null
    }

    init(): void {
      const selected = avcEncoderOverride
      if (!selected) throw new Error("Tu navegador no puede codificar video H.264.")
      const config: VideoEncoderConfig = {
        codec: selected.codec,
        width: this.config.width,
        height: this.config.height,
        bitrate: this.config.bitrate ?? TARGET_VIDEO_BITRATE,
        hardwareAcceleration: selected.hardwareAcceleration,
        avc: { format: "avc" },
      }
      if (this.config.framerate) config.framerate = this.config.framerate
      if (selected.bitrateMode) config.bitrateMode = selected.bitrateMode

      this.encoder = new VideoEncoder({
        output: (chunk, meta) => {
          this.onPacket(mb.EncodedPacket.fromEncodedChunk(chunk), meta)
        },
        error: (error) => {
          this.onError(error)
        },
      })
      this.encoder.configure(config)
    }

    async encode(sample: VideoSample, options: VideoEncoderEncodeOptions): Promise<void> {
      const encoder = this.encoder
      if (!encoder) throw new Error("El codificador de video no está listo.")
      const frame = sample.toVideoFrame()
      try {
        encoder.encode(frame, options)
      } finally {
        frame.close()
      }
      if (encoder.encodeQueueSize >= 4) {
        await new Promise((resolve) =>
          encoder.addEventListener("dequeue", resolve, { once: true }),
        )
      }
    }

    async flush(): Promise<void> {
      await this.encoder?.flush()
    }

    close(): void {
      if (this.encoder && this.encoder.state !== "closed") this.encoder.close()
      this.encoder = null
    }
  }

  mb.registerEncoder(NativeAvcEncoder)
  nativeAvcEncoderRegistered = true
}

/**
 * Elige el lado de salida (720 → 640 → 480) con el que el navegador puede
 * codificar H.264. Devuelve null si no hay ninguna configuración posible.
 */
async function negotiateAvcSide(
  mb: Mediabunny,
  maxSide: number,
  quality: InstanceType<Mediabunny["Quality"]>,
): Promise<number | null> {
  const sides = [maxSide, ...AVC_FALLBACK_SIDES.filter((s) => s < maxSide)]
  for (const side of sides) {
    if (await mb.canEncodeVideo("avc", { width: side, height: side, quality })) return side
    const override = await findSupportedAvcConfig(side)
    if (override) {
      console.info("promotion_video_avc_fallback", { side, ...override })
      installNativeAvcEncoder(mb, override)
      return side
    }
  }
  console.warn("promotion_video_avc_unsupported", {
    sides,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  })
  return null
}

interface FrameDrawSpec {
  width: number
  height: number
  fit: "fill" | "contain" | "cover"
  rotation: number
  flip: boolean
  crop: { left: number; top: number; width: number; height: number }
  fillBlack: boolean
}

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/**
 * Safari ignora el rectángulo de origen de `drawImage` con un VideoFrame y
 * pinta el frame entero en el destino (el recorte 1:1 salía estirado). Aquí
 * recortamos solo con transformaciones + rectángulo de destino.
 */
function drawSampleFrame(sample: VideoSample, ctx: Canvas2D, spec: FrameDrawSpec): void {
  const rawW = sample.squarePixelWidth
  const rawH = sample.squarePixelHeight
  const quarterTurn = spec.rotation % 180 !== 0
  const rotW = quarterTurn ? rawH : rawW
  const rotH = quarterTurn ? rawW : rawH
  const { crop } = spec

  let scaleX = spec.width / crop.width
  let scaleY = spec.height / crop.height
  let dx = 0
  let dy = 0
  if (spec.fit !== "fill") {
    const s = spec.fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)
    scaleX = s
    scaleY = s
    dx = (spec.width - crop.width * s) / 2
    dy = (spec.height - crop.height * s) / 2
  }

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = "source-over"
  if (spec.fillBlack) {
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, spec.width, spec.height)
  } else {
    ctx.clearRect(0, 0, spec.width, spec.height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.beginPath()
  ctx.rect(dx, dy, crop.width * scaleX, crop.height * scaleY)
  ctx.clip()
  ctx.translate(dx, dy)
  ctx.scale(scaleX, scaleY)
  ctx.translate(-crop.left, -crop.top)
  ctx.translate(rotW / 2, rotH / 2)
  if (spec.flip) ctx.scale(-1, 1)
  ctx.rotate((spec.rotation * Math.PI) / 180)
  ctx.drawImage(sample.toCanvasImageSource(), -rawW / 2, -rawH / 2, rawW, rawH)
  ctx.restore()
}

const drawCanvasCache = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>()

function getDrawCanvas(width: number, height: number, slot: string) {
  const key = `${slot}:${width}x${height}`
  let entry = drawCanvasCache.get(key)
  if (!entry) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) throw new Error("No se pudo crear el lienzo para procesar el video.")
    entry = { canvas, ctx }
    drawCanvasCache.set(key, entry)
  }
  return entry
}

/** Dibuja el frame en un canvas del tamaño final (con un paso intermedio si reduce mucho). */
function renderSampleToCanvas(sample: VideoSample, spec: FrameDrawSpec): HTMLCanvasElement {
  const target = getDrawCanvas(spec.width, spec.height, "target")
  const downscale = Math.min(spec.crop.width / spec.width, spec.crop.height / spec.height)
  if (downscale <= 2) {
    drawSampleFrame(sample, target.ctx, spec)
    return target.canvas
  }

  const midW = spec.width * 2
  const midH = spec.height * 2
  const mid = getDrawCanvas(midW, midH, "mid")
  drawSampleFrame(sample, mid.ctx, { ...spec, width: midW, height: midH })
  target.ctx.save()
  target.ctx.setTransform(1, 0, 0, 1, 0, 0)
  target.ctx.globalCompositeOperation = "copy"
  target.ctx.imageSmoothingEnabled = true
  target.ctx.imageSmoothingQuality = "high"
  target.ctx.drawImage(mid.canvas, 0, 0, midW, midH, 0, 0, spec.width, spec.height)
  target.ctx.restore()
  return target.canvas
}

let frameTransformerRegistered = false

function ensureFrameTransformer(mb: Mediabunny): void {
  if (frameTransformerRegistered) return
  mb.registerVideoSampleTransformer((sample, description) => {
    const canvas = renderSampleToCanvas(sample, {
      width: description.width,
      height: description.height,
      fit: description.fit,
      rotation: description.rotation,
      flip: description.flip,
      crop: description.crop,
      fillBlack: description.alpha === "discard",
    })
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(sample.timestamp * 1e6),
      duration: Math.round(sample.duration * 1e6),
      alpha: description.alpha === "discard" ? "discard" : "keep",
    })
    return new mb.VideoSample(frame, {
      timestamp: sample.timestamp,
      duration: sample.duration,
    })
  })
  frameTransformerRegistered = true
}

function evenFloor(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2)
}

function outputFileName(source: File): string {
  const base = source.name.replace(/\.[^.]+$/, "") || "video"
  return `${base}.mp4`
}

export interface VideoSourceInfo {
  durationSeconds: number
  /** Dimensiones de visualización (ya rotadas); null si no se pudieron leer. */
  width: number | null
  height: number | null
}

/** Encuadre del recorte 1:1: fracción 0–1 sobre el eje que sobra (0.5 = centro). */
export interface VideoFramingPan {
  x: number
  y: number
}

export interface PromotionVideoEdit {
  start: number
  end: number
  pan: VideoFramingPan
}

export function isSquareVideo(info: Pick<VideoSourceInfo, "width" | "height">): boolean {
  if (!info.width || !info.height) return true
  return Math.abs(info.width / info.height - 1) < 0.02
}

/**
 * Duración y tamaño del video original. Lee el contenedor (sirve para HEVC
 * aunque el navegador no pueda reproducirlo) y cae a `<video>` si hace falta.
 */
export async function probePromotionVideoSource(file: File): Promise<VideoSourceInfo | null> {
  try {
    const mb = await loadMediabunny()
    const input = new mb.Input({
      formats: mb.ALL_FORMATS,
      source: new mb.BlobSource(file),
    })
    try {
      if (await input.canRead()) {
        const d = await input.computeDuration()
        const track = await input.getPrimaryVideoTrack()
        if (Number.isFinite(d) && d > 0) {
          return {
            durationSeconds: d,
            width: track?.displayWidth || null,
            height: track?.displayHeight || null,
          }
        }
      }
    } finally {
      input.dispose()
    }
  } catch {
    // Probamos con el elemento <video>.
  }
  try {
    const d = await readVideoDurationSeconds(file)
    return { durationSeconds: d, width: null, height: null }
  } catch {
    return null
  }
}

/**
 * Fotogramas cuadrados para la tira del editor (data URLs JPEG).
 * Devuelve [] si el navegador no puede decodificar el video.
 */
export async function generatePromotionVideoFilmstrip(
  file: File,
  count: number,
  size = 72,
): Promise<string[]> {
  if (!hasWebCodecs()) return []
  const mb = await loadMediabunny()
  const input = new mb.Input({
    formats: mb.ALL_FORMATS,
    source: new mb.BlobSource(file),
  })
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track || !(await track.canDecode())) return []
    const duration = await input.computeDuration()
    const step = duration / count
    const timestamps = Array.from({ length: count }, (_, i) => i * step + step / 2)
    const sink = new mb.VideoSampleSink(track)
    const frames: string[] = []
    for await (const sample of sink.samplesAtTimestamps(timestamps)) {
      if (!sample) {
        if (frames.length > 0) frames.push(frames[frames.length - 1])
        continue
      }
      try {
        const quarterTurn = sample.rotation % 180 !== 0
        const rotW = quarterTurn ? sample.squarePixelHeight : sample.squarePixelWidth
        const rotH = quarterTurn ? sample.squarePixelWidth : sample.squarePixelHeight
        const side = Math.min(rotW, rotH)
        const canvas = renderSampleToCanvas(sample, {
          width: size,
          height: size,
          fit: "fill",
          rotation: sample.rotation,
          flip: sample.flip,
          crop: {
            left: Math.round((rotW - side) / 2),
            top: Math.round((rotH - side) / 2),
            width: side,
            height: side,
          },
          fillBlack: true,
        })
        frames.push(canvas.toDataURL("image/jpeg", 0.7))
      } finally {
        sample.close()
      }
    }
    return frames
  } catch {
    return []
  } finally {
    input.dispose()
  }
}

export function canOptimizeVideosInBrowser(): boolean {
  return hasWebCodecs()
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0.5))
}

async function transcode(
  file: File,
  opts: {
    trimStart: number
    trimEnd?: number
    pan?: VideoFramingPan
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
  },
): Promise<{ file: File; durationSeconds: number }> {
  const mb = await loadMediabunny()
  const input = new mb.Input({
    formats: mb.ALL_FORMATS,
    source: new mb.BlobSource(file),
  })

  try {
    if (!(await input.canRead())) {
      throw new VideoPrepareFatalError(
        "No pudimos leer este MP4. Prueba exportarlo de nuevo o usa otro archivo.",
      )
    }

    const videoTrack = await input.getPrimaryVideoTrack()
    if (!videoTrack) {
      throw new VideoPrepareFatalError("El archivo no contiene una pista de video.")
    }

    if (!(await videoTrack.canDecode())) {
      const codec = videoTrack.codec
      throw new Error(
        codec === "hevc"
          ? "Este MP4 usa el códec HEVC y tu navegador no puede procesarlo. Prueba desde Safari o Chrome actualizados, o exporta el video en H.264."
          : "Tu navegador no puede leer el códec de este video. Prueba desde Chrome, Edge o Safari actualizados.",
      )
    }

    const srcW = videoTrack.displayWidth || TARGET_MAX_SIDE
    const srcH = videoTrack.displayHeight || TARGET_MAX_SIDE
    const cropSide = Math.min(srcW, srcH)
    const pan = opts.pan ?? { x: 0.5, y: 0.5 }
    const crop = {
      left: Math.round((srcW - cropSide) * clamp01(pan.x)),
      top: Math.round((srcH - cropSide) * clamp01(pan.y)),
      width: cropSide,
      height: cropSide,
    }
    const videoQuality = new mb.Quality(TARGET_VIDEO_BITRATE)
    const side = await negotiateAvcSide(
      mb,
      evenFloor(Math.min(TARGET_MAX_SIDE, cropSide)),
      videoQuality,
    )
    if (side === null) {
      throw new Error(
        "Tu navegador no pudo iniciar el codificador de video. Actualízalo a la última versión o prueba desde Chrome o Edge.",
      )
    }

    ensureFrameTransformer(mb)

    const audioTrack = await input.getPrimaryAudioTrack()
    if (audioTrack) {
      await ensureAacEncoder(mb)
    }

    const duration = await input.computeDuration()
    const start = Math.min(Math.max(0, opts.trimStart), Math.max(0, duration - 0.5))
    const end = Math.min(
      duration,
      start + PROMOTION_VIDEO_MAX_DURATION_SECONDS,
      opts.trimEnd != null && opts.trimEnd > start ? opts.trimEnd : Infinity,
    )
    const needsTrim = start > 0 || end < duration

    let frameRate: number | undefined
    try {
      const stats = await videoTrack.computePacketStats(120)
      if (stats.averagePacketRate > TARGET_MAX_FPS + 1) frameRate = TARGET_MAX_FPS
    } catch {
      frameRate = undefined
    }

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    })

    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      trim: needsTrim ? { start, end } : undefined,
      video: {
        codec: "avc",
        width: side,
        height: side,
        fit: "cover",
        crop,
        quality: videoQuality,
        frameRate,
        forceTranscode: true,
        allowTransformationMetadata: false,
      },
      audio: {
        codec: "aac",
        quality: new mb.Quality(TARGET_AUDIO_BITRATE),
      },
    })

    if (!conversion.isValid) {
      throw new Error("Tu navegador no puede convertir este video.")
    }

    if (opts.onProgress) {
      conversion.onProgress = (p) => opts.onProgress?.(Math.min(1, Math.max(0, p)))
    }

    const onAbort = () => {
      void conversion.cancel()
    }
    opts.signal?.addEventListener("abort", onAbort, { once: true })
    try {
      if (opts.signal?.aborted) throw new VideoPrepareCanceledError()
      await conversion.execute()
    } catch (err) {
      if (err instanceof mb.ConversionCanceledError || opts.signal?.aborted) {
        throw new VideoPrepareCanceledError()
      }
      throw err
    } finally {
      opts.signal?.removeEventListener("abort", onAbort)
    }

    const buffer = output.target.buffer
    if (!buffer) {
      throw new Error("No se pudo generar el video optimizado.")
    }

    return {
      file: new File([buffer], outputFileName(file), { type: "video/mp4" }),
      durationSeconds: end - start,
    }
  } finally {
    input.dispose()
  }
}

/**
 * Deja el video listo para subir: optimiza en el navegador y, si no se puede,
 * usa el original siempre que ya cumpla (MP4, ≤ 50 MB, ≤ 30 s).
 */
export async function preparePromotionVideo(
  file: File,
  opts: {
    /** Recorte y encuadre elegidos en el editor; sin edit = primeros 30 s, centro. */
    edit?: PromotionVideoEdit
    onProgress?: (fraction: number) => void
    signal?: AbortSignal
  } = {},
): Promise<PreparedPromotionVideo> {
  if (!isMp4File(file)) {
    throw new Error(PROMOTION_VIDEO_ONLY_MP4_MESSAGE)
  }
  if (file.size > PROMOTION_VIDEO_SOURCE_MAX_BYTES) {
    throw new Error(
      `El archivo pesa ${formatFileSizeMb(file.size)}. Elige un video de menos de ${PROMOTION_VIDEO_SOURCE_MAX_BYTES / (1024 * 1024 * 1024)} GB.`,
    )
  }

  let transcodeError: unknown = null
  if (hasWebCodecs()) {
    try {
      const result = await transcode(file, {
        trimStart: opts.edit?.start ?? 0,
        trimEnd: opts.edit?.end,
        pan: opts.edit?.pan,
        onProgress: opts.onProgress,
        signal: opts.signal,
      })
      if (result.file.size <= PROMOTION_VIDEO_MAX_BYTES) {
        return {
          file: result.file,
          durationSeconds: result.durationSeconds,
          optimized: true,
          originalBytes: file.size,
        }
      }
      transcodeError = new Error(
        `El video optimizado sigue pesando ${formatFileSizeMb(result.file.size)} (máx. ${PROMOTION_VIDEO_MAX_BYTES / (1024 * 1024)} MB).`,
      )
    } catch (err) {
      if (err instanceof VideoPrepareCanceledError) throw err
      if (err instanceof VideoPrepareFatalError) throw err
      transcodeError = err
      console.warn("promotion_video_optimize_failed", err)
    }
  }

  try {
    const { durationSeconds } = await validatePromotionVideoFile(file)
    return { file, durationSeconds, optimized: false, originalBytes: file.size }
  } catch (fallbackErr) {
    if (transcodeError instanceof Error) throw transcodeError
    throw fallbackErr
  }
}
