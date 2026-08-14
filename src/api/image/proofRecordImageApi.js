import { adminFetch } from '../adminHttpClient.js'

const ALLOWED_PROOF_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export class ProofRecordImageRequestError extends Error {
  constructor(message = '运动凭证图片暂时无法获取', status = 0) {
    super(message)
    this.name = 'ProofRecordImageRequestError'
    this.status = status
  }
}

function normalizeProofRecordId(proofRecordId) {
  const normalizedId = Number(proofRecordId)
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new ProofRecordImageRequestError('运动凭证编号无效', 422)
  }

  return normalizedId
}

// 浏览器只提交待终审记录主键，凭证文件定位和业务归属校验统一留在后端完成。
export async function getProofRecordImage(proofRecordId, { signal } = {}) {
  const normalizedId = normalizeProofRecordId(proofRecordId)
  const response = await adminFetch(`image/proof_record/${normalizedId}`, {
    method: 'GET',
    headers: {
      Accept: Array.from(ALLOWED_PROOF_IMAGE_MEDIA_TYPES).join(', '),
    },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new ProofRecordImageRequestError('运动凭证图片暂时无法获取', response.status)
  }

  const mediaType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (!ALLOWED_PROOF_IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new ProofRecordImageRequestError('运动凭证图片服务返回了无效内容', 502)
  }

  return response.blob()
}
