import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isCompleteCalendarMonthRange,
  resolveMinimumSeasonEndDate,
} from '../src/services/seasonDateRange.js'

test('赛季最早结束日期为开始日期顺延一个自然月', () => {
  assert.deepEqual(
    resolveMinimumSeasonEndDate({ year: 2026, month: 9, day: 15 }),
    { year: 2026, month: 10, day: 14 },
  )
  assert.deepEqual(
    resolveMinimumSeasonEndDate({ year: 2026, month: 9, day: 1 }),
    { year: 2026, month: 9, day: 30 },
  )
})

test('赛季跨年时正确计算最早结束日期', () => {
  assert.deepEqual(
    resolveMinimumSeasonEndDate({ year: 2026, month: 12, day: 8 }),
    { year: 2027, month: 1, day: 7 },
  )
})

test('赛季从月末开始时将最早结束日期收敛到目标月末', () => {
  assert.deepEqual(
    resolveMinimumSeasonEndDate({ year: 2027, month: 1, day: 31 }),
    { year: 2027, month: 2, day: 27 },
  )
  assert.deepEqual(
    resolveMinimumSeasonEndDate({ year: 2028, month: 1, day: 31 }),
    { year: 2028, month: 2, day: 28 },
  )
})

test('完整日历月区间按包含首尾日期判断', () => {
  assert.equal(
    isCompleteCalendarMonthRange(
      { year: 2026, month: 8, day: 15 },
      { year: 2026, month: 9, day: 14 },
    ),
    true,
  )
  assert.equal(
    isCompleteCalendarMonthRange(
      { year: 2026, month: 8, day: 15 },
      { year: 2026, month: 9, day: 13 },
    ),
    false,
  )
})
