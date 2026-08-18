const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_OUTPUT_WIDTH = 1920
const MAX_OUTPUT_HEIGHT = 16384
const MAX_OUTPUT_PIXELS = 24 * 1024 * 1024
const TARGET_WEBP_BYTES = 4 * 1024 * 1024
const WEBP_QUALITY_STEPS = [0.9, 0.84, 0.78, 0.72, 0.66, 0.6]
const RESIZE_FACTOR = 0.9
const MIN_OUTPUT_WIDTH = 720

export class PosterImageProcessingError extends Error {
  constructor(message = '活动海报处理失败，请重新选择') {
    super(message)
    this.name = 'PosterImageProcessingError'
  }
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
      reject(new PosterImageProcessingError('活动海报无法解码，请更换文件'))
    }, { once: true })
    image.src = objectUrl
  })
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new PosterImageProcessingError('当前浏览器无法处理活动海报')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return { canvas, context }
}

function calculateOutputSize(sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) {
    throw new PosterImageProcessingError('活动海报尺寸无效')
  }
  const edgeScale = Math.min(
    1,
    MAX_OUTPUT_WIDTH / sourceWidth,
    MAX_OUTPUT_HEIGHT / sourceHeight,
  )
  const pixelScale = Math.min(1, Math.sqrt(MAX_OUTPUT_PIXELS / (sourceWidth * sourceHeight)))
  const scale = Math.min(edgeScale, pixelScale)
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

function drawImage(image) {
  const { width, height } = calculateOutputSize(image.naturalWidth, image.naturalHeight)
  const { canvas, context } = createCanvas(width, height)
  // 不填充背景，保证 PNG 或 WebP 原图中的透明通道在前端转换后仍被保留。
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

function resizeCanvas(sourceCanvas) {
  const width = Math.max(1, Math.round(sourceCanvas.width * RESIZE_FACTOR))
  const height = Math.max(1, Math.round(sourceCanvas.height * RESIZE_FACTOR))
  const { canvas, context } = createCanvas(width, height)
  context.drawImage(sourceCanvas, 0, 0, width, height)
  return canvas
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new PosterImageProcessingError('当前浏览器不支持 WebP 图片编码'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

async function compressCanvas(sourceCanvas, targetBytes) {
  let workingCanvas = sourceCanvas
  let smallestResult = null

  while (true) {
    for (const quality of WEBP_QUALITY_STEPS) {
      const blob = await canvasToWebp(workingCanvas, quality)
      const result = { blob, width: workingCanvas.width, height: workingCanvas.height }
      if (!smallestResult || blob.size < smallestResult.blob.size) smallestResult = result
      if (blob.size <= targetBytes) return result
    }

    if (workingCanvas.width <= MIN_OUTPUT_WIDTH) break
    workingCanvas = resizeCanvas(workingCanvas)
  }
  return smallestResult
}

export async function processPosterImage(file) {
  if (!(file instanceof Blob)) throw new PosterImageProcessingError('请选择有效的活动海报')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new PosterImageProcessingError('请选择 JPEG、PNG 或 WebP 活动海报')
  }
  if (file.size <= 0) throw new PosterImageProcessingError('活动海报不能为空')
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PosterImageProcessingError('活动海报原图不能超过 10 MiB')
  }

  const image = await loadImage(file)
  // 以原图大小和上传目标上限中的较小值作为压缩目标，避免“已转换 WebP”反而明显膨胀。
  const targetBytes = Math.min(TARGET_WEBP_BYTES, file.size)
  const result = await compressCanvas(drawImage(image), targetBytes)
  if (!result?.blob || result.blob.size > MAX_SOURCE_BYTES) {
    throw new PosterImageProcessingError('活动海报压缩后仍超过 10 MiB，请降低图片尺寸')
  }

  const webpFile = new File([result.blob], 'activity-poster.webp', {
    type: 'image/webp',
    lastModified: Date.now(),
  })
  return {
    file: webpFile,
    originalSize: file.size,
    size: webpFile.size,
    width: result.width,
    height: result.height,
  }
}

export function formatPosterImageSize(size) {
  if (!Number.isFinite(size) || size < 0) return ''
  if (size < 1024) return `${Math.round(size)} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 100 * 1024 ? 1 : 0)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MiB`
}
