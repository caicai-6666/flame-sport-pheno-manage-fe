function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function assertValidDateParts(dateParts) {
  const { year, month, day } = dateParts
  const maximumDay = getDaysInMonth(year, month)

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || !Number.isInteger(day)
    || month < 1
    || month > 12
    || day < 1
    || day > maximumDay
  ) {
    throw new TypeError('赛季日期无效')
  }
}

/**
 * 起止日期都会计入赛季天数，因此顺延一个自然月的日期需要再减一天作为最早结束日。
 * 月末顺延时若目标月份没有同日，先收敛到目标月末，再回退一天。
 */
export function resolveMinimumSeasonEndDate(startDate) {
  assertValidDateParts(startDate)

  const targetMonthStart = new Date(startDate.year, startDate.month, 1)
  const targetYear = targetMonthStart.getFullYear()
  const targetMonth = targetMonthStart.getMonth() + 1

  const anniversaryDay = Math.min(startDate.day, getDaysInMonth(targetYear, targetMonth))
  const minimumEndDate = new Date(targetYear, targetMonth - 1, anniversaryDay - 1)

  return {
    year: minimumEndDate.getFullYear(),
    month: minimumEndDate.getMonth() + 1,
    day: minimumEndDate.getDate(),
  }
}

export function isCompleteCalendarMonthRange(startDate, endDate) {
  assertValidDateParts(endDate)
  const minimumEndDate = resolveMinimumSeasonEndDate(startDate)
  const toComparableValue = ({ year, month, day }) => (
    year * 10000 + month * 100 + day
  )

  return toComparableValue(endDate) >= toComparableValue(minimumEndDate)
}
