const loadChallengeLevelEnrollmentCard = () =>
  import('../components/dashboard/ChallengeLevelEnrollmentCard.vue')

const loadProjectEnrollmentCard = () =>
  import('../components/dashboard/ProjectEnrollmentCard.vue')

export class DashboardLayoutPreloadError extends Error {
  constructor() {
    super('工作台界面加载失败，请刷新后重试')
    this.name = 'DashboardLayoutPreloadError'
  }
}

// 这里只预热决定看板容器结构的异步组件，不等待任何业务接口响应。
export async function preloadDashboardLayout() {
  try {
    return await Promise.all([
      loadChallengeLevelEnrollmentCard(),
      loadProjectEnrollmentCard(),
    ])
  } catch {
    throw new DashboardLayoutPreloadError()
  }
}

export {
  loadChallengeLevelEnrollmentCard,
  loadProjectEnrollmentCard,
}
