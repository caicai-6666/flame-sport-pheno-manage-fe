function createCreatedAtLabel(createdAt) {
  const [datePart, timePart] = createdAt.split('T')
  const [, month, day] = datePart.split('-')
  return `${month}月${day}日 ${timePart.slice(0, 5)}`
}

// 正文只做首尾空白规范化，完整内容由通用列表的展开状态负责展示。
export function createUserSuggestionView(suggestions) {
  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    marker: suggestion.userName.slice(0, 1),
    title: suggestion.userName,
    description: suggestion.content,
    avatarUrl: suggestion.avatarUrl,
    avatarObjectUrl: undefined,
    avatarLoadFailed: false,
    createdAt: suggestion.createdAt,
    meta: createCreatedAtLabel(suggestion.createdAt),
    status: '可见意见',
  }))
}
