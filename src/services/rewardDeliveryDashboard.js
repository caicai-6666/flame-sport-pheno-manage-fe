function createCreatedAtLabel(createdAt) {
  const [datePart, timePart] = createdAt.split('T')
  const [, month, day] = datePart.split('-')
  return `${month}月${day}日 ${timePart.slice(0, 5)}`
}

export function createRewardDeliveryView(distributions, members, products) {
  const memberByUserId = new Map(members.map((member) => [member.id, member]))
  const productById = new Map(products.map((product) => [product.id, product]))

  return distributions.map((distribution) => {
    const member = memberByUserId.get(distribution.userId)
    const product = productById.get(distribution.productId)
    if (!product) throw new Error(`待发放流水缺少奖品信息：${distribution.productId}`)

    const userName = member?.name ?? distribution.userId
    return {
      id: distribution.id,
      userId: distribution.userId,
      productId: distribution.productId,
      marker: userName.slice(0, 1),
      title: `${userName} · ${product.name}`,
      // 列表只保留用户部门，不重复展示奖品说明；完整资料由悬浮详情承载。
      description: member?.department ?? null,
      avatarUrl: member?.avatarUrl ?? null,
      avatarObjectUrl: member?.avatarObjectUrl,
      avatarLoadFailed: member?.avatarLoadFailed ?? false,
      createdAt: distribution.createdAt,
      meta: createCreatedAtLabel(distribution.createdAt),
      exchangeDescription: distribution.description,
      product,
      detail: {
        title: product.name,
        description: product.description ?? distribution.description ?? '暂无奖品说明',
        meta: `商品 #${product.id}`,
        imageUrl: product.imageUrl,
        imageObjectUrl: undefined,
        imageLoading: false,
        imageLoadFailed: false,
      },
    }
  })
}
