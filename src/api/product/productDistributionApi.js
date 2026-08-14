import { adminFetch } from '../adminHttpClient.js'

export class ProductDistributionRequestError extends Error {
  constructor(message = '礼品发放审核暂时无法完成', status = 0) {
    super(message)
    this.name = 'ProductDistributionRequestError'
    this.status = status
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

const PRODUCT_DISTRIBUTION_DECISIONS = new Set(['distributed', 'rejected'])

function createResponseError(status) {
  if (status === 404) {
    return new ProductDistributionRequestError('兑换流水不存在', status)
  }
  if (status === 409) {
    return new ProductDistributionRequestError('礼品已有不同处理结论或当前状态异常', status)
  }
  if (status === 422) {
    return new ProductDistributionRequestError('礼品发放审核参数无效', status)
  }
  return new ProductDistributionRequestError('礼品发放审核失败，请稍后重试', status)
}

// 两种审核结论都会改变兑换流水，网络结果不明确时不自动重放，由管理员主动再次确认。
export async function reviewProductDistribution(
  distributionId,
  decision,
  { signal } = {},
) {
  if (!Number.isInteger(distributionId) || distributionId <= 0) {
    throw new ProductDistributionRequestError('兑换流水编号无效', 422)
  }
  if (!PRODUCT_DISTRIBUTION_DECISIONS.has(decision)) {
    throw new ProductDistributionRequestError('礼品发放审核决定无效', 422)
  }

  const response = await adminFetch('product/distribute', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: distributionId, decision }),
    signal,
  })
  const payload = await readJsonResponse(response)

  if (!response.ok) throw createResponseError(response.status)
  if (
    payload?.id !== distributionId ||
    payload?.gift_distribution_status !== decision
  ) {
    throw new ProductDistributionRequestError('礼品发放审核接口返回了无法识别的数据')
  }

  return {
    id: payload.id,
    giftDistributionStatus: payload.gift_distribution_status,
  }
}
