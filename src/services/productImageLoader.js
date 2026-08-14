import {
  getProductImage,
  ProductImageRequestError,
} from '../api/image/productImageApi.js'

const MAX_CONCURRENT_PRODUCT_IMAGE_REQUESTS = 5
const MAX_PRODUCT_IMAGE_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 300

function waitForRetry(delayMs, signal) {
  if (delayMs <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timerId = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, delayMs)

    function handleAbort() {
      window.clearTimeout(timerId)
      reject(new DOMException('奖品图片请求已取消', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function shouldRetryProductImageRequest(error) {
  if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') {
    return false
  }
  if (error instanceof ProductImageRequestError) {
    return error.status === 0 || error.status >= 500
  }
  return true
}

async function loadProductImageWithRetry(
  imageUrl,
  { signal, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  let attempt = 0

  while (true) {
    try {
      return await getProductImage(imageUrl, { signal })
    } catch (error) {
      if (!shouldRetryProductImageRequest(error) || attempt >= MAX_PRODUCT_IMAGE_RETRIES) {
        throw error
      }
      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function createImageTasks(products) {
  const taskByImageUrl = new Map()

  products.forEach((product) => {
    const imageUrl = typeof product.imageUrl === 'string' ? product.imageUrl.trim() : ''
    if (!imageUrl) return

    const task = taskByImageUrl.get(imageUrl)
    if (task) {
      task.productIds.push(product.id)
      return
    }
    taskByImageUrl.set(imageUrl, { imageUrl, productIds: [product.id] })
  })

  return Array.from(taskByImageUrl.values())
}

// 相同图片地址只请求一次，并以固定工作协程限制奖品较多时的瞬时并发。
export async function loadProductImages(
  products,
  { signal, onImageLoaded, onImageFailed, retryDelayMs } = {},
) {
  const tasks = createImageTasks(products)

  async function loadTask(task) {
    try {
      const blob = await loadProductImageWithRetry(task.imageUrl, {
        signal,
        retryDelayMs,
      })
      if (!signal?.aborted) onImageLoaded?.({ ...task, blob })
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') {
        throw error
      }
      onImageFailed?.(task)
    }
  }

  // 每批最多请求 5 张；整批完成后再进入下一批，避免滚动补位形成持续请求洪峰。
  for (let index = 0; index < tasks.length; index += MAX_CONCURRENT_PRODUCT_IMAGE_REQUESTS) {
    const batch = tasks.slice(index, index + MAX_CONCURRENT_PRODUCT_IMAGE_REQUESTS)
    await Promise.all(batch.map(loadTask))
  }
}
