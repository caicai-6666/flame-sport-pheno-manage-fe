const MAX_SOURCE_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_OUTPUT_EDGE = 1600
const TARGET_WEBP_BYTES = 300 * 1024
const WEBP_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]
const RESIZE_FACTOR = 0.84
const MIN_RESIZED_EDGE = 480

export class ProductImageProcessingError extends Error {
  constructor(message = '奖品图片处理失败，请重新选择') {
    super(message)
    this.name = 'ProductImageProcessingError'
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')), { once: true })
    reader.addEventListener('error', () => reject(new ProductImageProcessingError()), { once: true })
    reader.readAsDataURL(blob)
  })
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.addEventListener('load', () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }, { once: true })
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl)
      reject(new ProductImageProcessingError('奖品图片无法解码，请更换文件'))
    }, { once: true })
    image.src = objectUrl
  })
}

function canvasToWebpBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new ProductImageProcessingError('当前浏览器不支持 WebP 图片编码'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new ProductImageProcessingError('当前浏览器无法处理奖品图片')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return { canvas, context }
}

function drawSourceImage(image) {
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  if (!sourceWidth || !sourceHeight) throw new ProductImageProcessingError('奖品图片尺寸无效')

  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const { canvas, context } = createCanvas(width, height)
  // WebP 支持透明通道，画布不填底色，避免 PNG 透明区域在转换时丢失。
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

function resizeCanvas(sourceCanvas, factor) {
  const width = Math.max(1, Math.round(sourceCanvas.width * factor))
  const height = Math.max(1, Math.round(sourceCanvas.height * factor))
  const { canvas, context } = createCanvas(width, height)
  context.drawImage(sourceCanvas, 0, 0, width, height)
  return canvas
}

function createWebpFileName(originalName) {
  const normalizedName = typeof originalName === 'string' ? originalName.trim() : ''
  const baseName = normalizedName.replace(/\.[^.]+$/, '').trim() || 'product-image'
  return `${baseName}.webp`
}

async function encodeCompressedWebp(sourceCanvas) {
  let workingCanvas = sourceCanvas
  let smallestResult = null

  while (true) {
    for (const quality of WEBP_QUALITY_STEPS) {
      const blob = await canvasToWebpBlob(workingCanvas, quality)
      const result = { blob, width: workingCanvas.width, height: workingCanvas.height }
      if (!smallestResult || blob.size < smallestResult.blob.size) smallestResult = result
      if (blob.size <= TARGET_WEBP_BYTES) return result
    }

    if (Math.max(workingCanvas.width, workingCanvas.height) <= MIN_RESIZED_EDGE) break
    workingCanvas = resizeCanvas(workingCanvas, RESIZE_FACTOR)
  }

  return smallestResult
}

export async function processProductImage(file) {
  if (!(file instanceof Blob)) throw new ProductImageProcessingError('请选择有效的奖品图片')
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new ProductImageProcessingError('请选择 PNG、JPG 或 WebP 图片')
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new ProductImageProcessingError('原始图片大小不能超过 5 MB')
  }

  const image = await loadImage(file)
  const result = await encodeCompressedWebp(drawSourceImage(image))
  if (!result?.blob) throw new ProductImageProcessingError()

  const fileName = createWebpFileName(file.name)
  const webpFile = new File([result.blob], fileName, {
    type: 'image/webp',
    lastModified: Date.now(),
  })
  return {
    file: webpFile,
    dataUrl: await readBlobAsDataUrl(webpFile),
    fileName,
    originalSize: file.size,
    size: webpFile.size,
    width: result.width,
    height: result.height,
    aspectRatio: result.width / result.height,
  }
}

export function formatImageSize(size) {
  if (!Number.isFinite(size) || size < 0) return ''
  if (size < 1024) return `${Math.round(size)} B`
  return `${(size / 1024).toFixed(size < 100 * 1024 ? 1 : 0)} KB`
}
