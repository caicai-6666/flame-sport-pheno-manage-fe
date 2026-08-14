import {
  getProofRecordImage,
  ProofRecordImageRequestError,
} from '../api/image/proofRecordImageApi.js'

export const PROOF_IMAGE_BATCH_SIZE = 5
export const PROOF_IMAGE_BATCH_TRIGGER_OFFSET = 3
const DEFAULT_MAX_CONCURRENT_REQUESTS = 3
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 300

function waitForRetry(delayMs, signal) {
  if (delayMs <= 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, delayMs)

    function handleAbort() {
      clearTimeout(timerId)
      reject(new DOMException('运动凭证图片请求已取消', 'AbortError'))
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

  if (error instanceof ProofRecordImageRequestError) {
    return error.status === 0 || error.status >= 500
  }

  return true
}

async function requestWithRetry(recordId, {
  requestImage,
  signal,
  maxRetries,
  retryDelayMs,
}) {
  let attempt = 0

  while (true) {
    try {
      return await requestImage(recordId, { signal })
    } catch (error) {
      if (!shouldRetry(error) || attempt >= maxRetries) throw error

      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function normalizeRecords(records) {
  return records.map((record, index) => ({
    ...record,
    queueIndex: Number.isInteger(record.queueIndex) ? record.queueIndex : index,
  }))
}

/**
 * 按审核位置渐进预取凭证图片。队列、活动请求和已完成集合共同保证同一图片不会重复请求。
 */
export function createProofRecordImageScheduler({
  requestImage = getProofRecordImage,
  onQueued = () => {},
  onLoaded = () => {},
  onFailed = () => {},
  maxConcurrent = DEFAULT_MAX_CONCURRENT_REQUESTS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  let records = []
  let queue = []
  let activeCount = 0
  let disposed = false
  let nextBatchStart = PROOF_IMAGE_BATCH_SIZE
  let nextTriggerIndex = PROOF_IMAGE_BATCH_TRIGGER_OFFSET
  const queuedIds = new Set()
  const activeIds = new Set()
  const loadedIds = new Set()
  const controller = new AbortController()
  const idleResolvers = new Set()

  function resolveIdle() {
    if (activeCount > 0 || queue.length > 0) return
    idleResolvers.forEach((resolve) => resolve())
    idleResolvers.clear()
  }

  async function run(record) {
    activeCount += 1
    activeIds.add(record.id)

    try {
      const blob = await requestWithRetry(record.id, {
        requestImage,
        signal: controller.signal,
        maxRetries,
        retryDelayMs,
      })
      if (disposed) return

      loadedIds.add(record.id)
      onLoaded({ record, blob })
    } catch (error) {
      if (
        disposed ||
        error?.name === 'AbortError' ||
        error?.name === 'AdminAuthenticationRequiredError'
      ) {
        return
      }

      onFailed({ record, error })
    } finally {
      activeCount -= 1
      activeIds.delete(record.id)
      pump()
      resolveIdle()
    }
  }

  function pump() {
    if (disposed) return

    while (activeCount < maxConcurrent && queue.length > 0) {
      const record = queue.shift()
      queuedIds.delete(record.id)
      void run(record)
    }
  }

  function enqueue(record, { priority = false } = {}) {
    if (
      disposed ||
      !record ||
      loadedIds.has(record.id) ||
      activeIds.has(record.id)
    ) {
      return
    }

    if (queuedIds.has(record.id)) {
      if (priority) {
        // 审核员主动点开的记录应越过尚未开始的预取任务，但不会带出相邻图片。
        const queuedIndex = queue.findIndex((item) => item.id === record.id)
        if (queuedIndex > 0) queue.unshift(queue.splice(queuedIndex, 1)[0])
      }
      return
    }

    if (priority) queue.unshift(record)
    else queue.push(record)
    queuedIds.add(record.id)
    onQueued({ record })
    pump()
  }

  function enqueueBatch(startIndex) {
    records
      .slice(startIndex, startIndex + PROOF_IMAGE_BATCH_SIZE)
      .forEach((record) => enqueue(record))
  }

  function initialize(nextRecords) {
    if (records.length > 0 || disposed) return

    records = normalizeRecords(nextRecords)
    enqueueBatch(0)
  }

  function select(record) {
    if (disposed || !record) return

    const scheduledRecord = records.find((item) => item.id === record.id) ?? record
    enqueue(scheduledRecord, { priority: true })

    // 每批第 4 条是下一批的预取水位；越级点击不会跨批扩散，只加载被点击的一张。
    if (scheduledRecord.queueIndex === nextTriggerIndex) {
      enqueueBatch(nextBatchStart)
      nextBatchStart += PROOF_IMAGE_BATCH_SIZE
      nextTriggerIndex += PROOF_IMAGE_BATCH_SIZE
    }
  }

  function retry(record) {
    if (disposed || !record) return

    loadedIds.delete(record.id)
    select(record)
  }

  function whenIdle() {
    if (activeCount === 0 && queue.length === 0) return Promise.resolve()
    return new Promise((resolve) => idleResolvers.add(resolve))
  }

  function dispose() {
    if (disposed) return

    disposed = true
    controller.abort()
    queue = []
    queuedIds.clear()
    resolveIdle()
  }

  return {
    initialize,
    select,
    retry,
    whenIdle,
    dispose,
  }
}
