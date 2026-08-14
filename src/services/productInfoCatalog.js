import { getProductInfo, ProductInfoRequestError } from '../api/product/productInfoApi.js'

const MAX_CONCURRENT_PRODUCT_INFO_REQUESTS = 5
const MAX_PRODUCT_INFO_RETRIES = 2
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
      reject(new DOMException('奖品信息请求已取消', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function shouldRetry(error) {
  if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') {
    return false
  }
  if (error instanceof ProductInfoRequestError) {
    return error.status === 0 || error.status >= 500
  }
  return true
}

async function loadProductWithRetry(productId, { signal, retryDelayMs }) {
  let attempt = 0

  while (true) {
    try {
      return await getProductInfo(productId, { signal })
    } catch (error) {
      if (!shouldRetry(error) || attempt >= MAX_PRODUCT_INFO_RETRIES) throw error
      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function normalizeProductIds(productIds) {
  return Array.from(new Set(productIds.filter(
    (productId) => Number.isInteger(productId) && productId > 0,
  )))
}

export function createProductInfoCatalog() {
  const productById = new Map()

  async function getOrLoad(
    productIds,
    { signal, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
  ) {
    const normalizedProductIds = normalizeProductIds(productIds)
    const missingProductIds = normalizedProductIds.filter(
      (productId) => !productById.has(productId),
    )
    let nextProductIndex = 0

    async function runWorker() {
      while (nextProductIndex < missingProductIds.length) {
        const productId = missingProductIds[nextProductIndex]
        nextProductIndex += 1
        const product = await loadProductWithRetry(productId, { signal, retryDelayMs })
        productById.set(productId, product)
      }
    }

    const workerCount = Math.min(
      MAX_CONCURRENT_PRODUCT_INFO_REQUESTS,
      missingProductIds.length,
    )
    await Promise.all(Array.from({ length: workerCount }, runWorker))
    return normalizedProductIds.map((productId) => productById.get(productId))
  }

  function clear() {
    productById.clear()
  }

  return { clear, getOrLoad }
}
