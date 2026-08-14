import {
  getPendingFinalReviews,
  PendingFinalReviewRequestError,
} from '../api/proof/pendingFinalReviewApi.js'

const MAX_CONCURRENT_PENDING_REVIEW_REQUESTS = 5
const MAX_PENDING_REVIEW_RETRIES = 2
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
      reject(new DOMException('待终审记录请求已取消', 'AbortError'))
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

  if (error instanceof PendingFinalReviewRequestError) {
    return error.status === 0 || error.status >= 500
  }

  return true
}

async function queryParticipantReviews(participant, { signal, retryDelayMs }) {
  let attempt = 0

  while (true) {
    try {
      return await getPendingFinalReviews(participant.seasonUserId, { signal })
    } catch (error) {
      if (!shouldRetry(error) || attempt >= MAX_PENDING_REVIEW_RETRIES) throw error

      const delayMs = retryDelayMs * (2 ** attempt)
      attempt += 1
      await waitForRetry(delayMs, signal)
    }
  }
}

function comparePendingReviews(left, right) {
  const proofDateOrder = right.proofDate.localeCompare(left.proofDate)
  if (proofDateOrder !== 0) return proofDateOrder

  const createdAtOrder = Date.parse(right.createdAt) - Date.parse(left.createdAt)
  if (createdAtOrder !== 0) return createdAtOrder
  return right.id - left.id
}

// 后端按单个 season_user 查询，前端受控并发后重新执行全局倒序，避免分组结果破坏最近优先口径。
export async function loadPendingFinalReviewRecords(
  participants,
  { signal, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  const records = []
  const recordIds = new Set()
  let nextParticipantIndex = 0
  let fatalError = null

  async function runWorker() {
    while (!fatalError && nextParticipantIndex < participants.length) {
      const participant = participants[nextParticipantIndex]
      nextParticipantIndex += 1

      try {
        const participantRecords = await queryParticipantReviews(participant, {
          signal,
          retryDelayMs,
        })

        participantRecords.forEach((record) => {
          if (recordIds.has(record.id)) {
            throw new PendingFinalReviewRequestError('待终审记录接口返回了重复凭证')
          }

          recordIds.add(record.id)
          records.push({
            ...record,
            seasonUserId: participant.seasonUserId,
            userId: participant.userId,
            levelId: participant.levelId,
            levelName: participant.levelName,
          })
        })
      } catch (error) {
        fatalError = error
        throw error
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_PENDING_REVIEW_REQUESTS, participants.length)
  await Promise.all(Array.from({ length: workerCount }, runWorker))
  return records.sort(comparePendingReviews)
}
