import { getSettlementParticipants } from '../api/settlement/settlementApi.js'

const PARTICIPANT_BATCH_SIZE = 1000

// 接口单次最多接收 1000 个 ID；按原始顺序分批可保持跨批次展示顺序稳定。
export async function loadSettlementParticipants(seasonUserIds, { signal } = {}) {
  if (!Array.isArray(seasonUserIds) || seasonUserIds.length === 0) return []

  const participants = []
  for (let offset = 0; offset < seasonUserIds.length; offset += PARTICIPANT_BATCH_SIZE) {
    const batchIds = seasonUserIds.slice(offset, offset + PARTICIPANT_BATCH_SIZE)
    const batchParticipants = await getSettlementParticipants(batchIds, { signal })
    participants.push(...batchParticipants)
  }

  return participants
}
