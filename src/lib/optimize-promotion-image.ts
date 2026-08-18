const PUSH_IMAGE_MAX_BYTES = 950 * 1024
const QUALITY_STEPS = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72]
const SCALE_STEPS = 8
const SCALE_FACTOR = 0.85

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("No se pudo leer la imagen"))
    }
    image.src = url
  })
}

function canvasToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("No se pudo optimizar la imagen"))
  }
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo convertir la imagen a JPG"))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "publicacion"
  return `${base}.jpg`
}

/**
 * Convierte a JPEG. Baja calidad (y luego escala) solo si hace falta
 * para quedar bajo el límite de 1 MB de FCM.
 */
export async function optimizePromotionImageFile(file: File): Promise<File> {
  if (file.type === "image/jpeg" && file.size <= PUSH_IMAGE_MAX_BYTES) {
    return file
  }

  const image = await loadImage(file)
  let width = image.naturalWidth || image.width
  let height = image.naturalHeight || image.height
  if (width < 1 || height < 1) {
    throw new Error("Imagen inválida")
  }

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToJpeg(image, width, height, quality)
    if (blob.size <= PUSH_IMAGE_MAX_BYTES) {
      return new File([blob], jpegFileName(file.name), { type: "image/jpeg" })
    }
  }

  for (let i = 0; i < SCALE_STEPS; i += 1) {
    width = Math.max(1, Math.round(width * SCALE_FACTOR))
    height = Math.max(1, Math.round(height * SCALE_FACTOR))
    const blob = await canvasToJpeg(image, width, height, 0.8)
    if (blob.size <= PUSH_IMAGE_MAX_BYTES) {
      return new File([blob], jpegFileName(file.name), { type: "image/jpeg" })
    }
  }

  throw new Error(
    "No se pudo dejar la imagen por debajo de 1 MB. Prueba un archivo más liviano.",
  )
}
