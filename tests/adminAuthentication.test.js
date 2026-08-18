import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import { createServer } from 'vite'

const storedValues = new Map()
let viteServer
let authApi
let httpClient
let adminSession
let currentSeasonApi
let currentSeasonDashboard
let seasonListApi
let seasonCreateApi
let projectLevelListApi
let projectLevelCreateApi
let projectLevelRewardUpdateApi
let projectListApi
let projectCreateApi
let projectStatusUpdateApi
let projectCatalog
let projectParticipantsApi
let projectParticipantsLoader
let projectEnrollmentDashboard
let userInfoApi
let levelEnrollmentMembers
let avatarApi
let memberAvatarLoader
let projectIconApi
let projectIconLoader
let pendingFinalReviewApi
let pendingFinalReviewLoader
let pendingFinalReviewDashboard
let projectRuleApi
let projectRuleUpdateApi
let projectRuleCatalog
let proofRecordImageApi
let proofRecordImageScheduler
let finalReviewApi
let suggestionListApi
let suggestionProcessApi
let userSuggestionDashboard
let pendingDistributionsApi
let productListApi
let productCreateApi
let productStatusUpdateApi
let productUpdateApi
let productInfoApi
let productInfoCatalog
let userProfileCatalog
let rewardDeliveryDashboard
let productImageApi
let productImageLoader
let productDistributionApi

// 提供最小浏览器会话环境，使认证模块在 Node 中按真实 sessionStorage 行为运行。
function installBrowserSessionStub() {
  globalThis.window = {
    clearTimeout: globalThis.clearTimeout,
    setTimeout: globalThis.setTimeout,
    sessionStorage: {
      getItem(key) {
        return storedValues.get(key) ?? null
      },
      removeItem(key) {
        storedValues.delete(key)
      },
      setItem(key, value) {
        storedValues.set(key, value)
      },
    },
  }
}

before(async () => {
  installBrowserSessionStub()
  viteServer = await createServer({
    mode: 'development',
    server: { middlewareMode: true },
    appType: 'custom',
  })
  authApi = await viteServer.ssrLoadModule('/src/api/auth/adminAuthApi.js')
  httpClient = await viteServer.ssrLoadModule('/src/api/adminHttpClient.js')
  adminSession = await viteServer.ssrLoadModule('/src/services/adminSession.js')
  currentSeasonApi = await viteServer.ssrLoadModule('/src/api/dashboard/currentSeasonApi.js')
  currentSeasonDashboard = await viteServer.ssrLoadModule(
    '/src/services/currentSeasonDashboard.js',
  )
  seasonListApi = await viteServer.ssrLoadModule('/src/api/season/seasonListApi.js')
  seasonCreateApi = await viteServer.ssrLoadModule('/src/api/season/seasonCreateApi.js')
  projectLevelListApi = await viteServer.ssrLoadModule(
    '/src/api/project-level/projectLevelListApi.js',
  )
  projectLevelCreateApi = await viteServer.ssrLoadModule(
    '/src/api/project-level/projectLevelCreateApi.js',
  )
  projectLevelRewardUpdateApi = await viteServer.ssrLoadModule(
    '/src/api/project-level/projectLevelRewardUpdateApi.js',
  )
  projectListApi = await viteServer.ssrLoadModule('/src/api/project/projectListApi.js')
  projectCreateApi = await viteServer.ssrLoadModule('/src/api/project/projectCreateApi.js')
  projectStatusUpdateApi = await viteServer.ssrLoadModule(
    '/src/api/project/projectStatusUpdateApi.js',
  )
  projectCatalog = await viteServer.ssrLoadModule('/src/services/projectCatalog.js')
  projectParticipantsApi = await viteServer.ssrLoadModule(
    '/src/api/dashboard/projectParticipantsApi.js',
  )
  projectParticipantsLoader = await viteServer.ssrLoadModule(
    '/src/services/projectParticipantsLoader.js',
  )
  projectEnrollmentDashboard = await viteServer.ssrLoadModule(
    '/src/services/projectEnrollmentDashboard.js',
  )
  userInfoApi = await viteServer.ssrLoadModule('/src/api/user/userInfoApi.js')
  levelEnrollmentMembers = await viteServer.ssrLoadModule(
    '/src/services/levelEnrollmentMembers.js',
  )
  avatarApi = await viteServer.ssrLoadModule('/src/api/image/avatarApi.js')
  memberAvatarLoader = await viteServer.ssrLoadModule(
    '/src/services/memberAvatarLoader.js',
  )
  projectIconApi = await viteServer.ssrLoadModule('/src/api/image/projectIconApi.js')
  projectIconLoader = await viteServer.ssrLoadModule(
    '/src/services/projectIconLoader.js',
  )
  pendingFinalReviewApi = await viteServer.ssrLoadModule(
    '/src/api/proof/pendingFinalReviewApi.js',
  )
  pendingFinalReviewLoader = await viteServer.ssrLoadModule(
    '/src/services/pendingFinalReviewLoader.js',
  )
  pendingFinalReviewDashboard = await viteServer.ssrLoadModule(
    '/src/services/pendingFinalReviewDashboard.js',
  )
  projectRuleApi = await viteServer.ssrLoadModule('/src/api/project/projectRuleApi.js')
  projectRuleUpdateApi = await viteServer.ssrLoadModule(
    '/src/api/project/projectRuleUpdateApi.js',
  )
  projectRuleCatalog = await viteServer.ssrLoadModule(
    '/src/services/projectRuleCatalog.js',
  )
  proofRecordImageApi = await viteServer.ssrLoadModule(
    '/src/api/image/proofRecordImageApi.js',
  )
  proofRecordImageScheduler = await viteServer.ssrLoadModule(
    '/src/services/proofRecordImageScheduler.js',
  )
  finalReviewApi = await viteServer.ssrLoadModule('/src/api/proof/finalReviewApi.js')
  suggestionListApi = await viteServer.ssrLoadModule(
    '/src/api/suggestion/suggestionListApi.js',
  )
  suggestionProcessApi = await viteServer.ssrLoadModule(
    '/src/api/suggestion/suggestionProcessApi.js',
  )
  userSuggestionDashboard = await viteServer.ssrLoadModule(
    '/src/services/userSuggestionDashboard.js',
  )
  pendingDistributionsApi = await viteServer.ssrLoadModule(
    '/src/api/product/pendingDistributionsApi.js',
  )
  productListApi = await viteServer.ssrLoadModule('/src/api/product/productListApi.js')
  productCreateApi = await viteServer.ssrLoadModule('/src/api/product/productCreateApi.js')
  productStatusUpdateApi = await viteServer.ssrLoadModule(
    '/src/api/product/productStatusUpdateApi.js',
  )
  productUpdateApi = await viteServer.ssrLoadModule('/src/api/product/productUpdateApi.js')
  productInfoApi = await viteServer.ssrLoadModule('/src/api/product/productInfoApi.js')
  productInfoCatalog = await viteServer.ssrLoadModule(
    '/src/services/productInfoCatalog.js',
  )
  userProfileCatalog = await viteServer.ssrLoadModule(
    '/src/services/userProfileCatalog.js',
  )
  rewardDeliveryDashboard = await viteServer.ssrLoadModule(
    '/src/services/rewardDeliveryDashboard.js',
  )
  productImageApi = await viteServer.ssrLoadModule('/src/api/image/productImageApi.js')
  productImageLoader = await viteServer.ssrLoadModule(
    '/src/services/productImageLoader.js',
  )
  productDistributionApi = await viteServer.ssrLoadModule(
    '/src/api/product/productDistributionApi.js',
  )
})

afterEach(() => {
  adminSession.clearAdminSession()
  storedValues.clear()
  delete globalThis.fetch
})

after(async () => {
  await viteServer.close()
  delete globalThis.window
})

test('登录成功后保存令牌，并为受保护请求添加 Bearer 请求头', async () => {
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })

    if (url.endsWith('/auth/login')) {
      return new Response(
        JSON.stringify({
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 28800,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await authApi.loginAdmin('test-admin-key')
  await httpClient.adminFetch('seasons', { method: 'GET' })

  assert.equal(requests[0].url, '/dev/flame/admin/api/auth/login')
  assert.deepEqual(JSON.parse(requests[0].options.body), { admin_key: 'test-admin-key' })
  assert.equal(requests[1].url, '/dev/flame/admin/api/seasons')
  assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer test-access-token')
  assert.equal(requests[1].options.redirect, 'manual')
  assert.equal(adminSession.getAdminAccessToken(), 'test-access-token')
})

test('密钥错误时展示统一错误且不保存提交密钥', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: '管理员密钥无效' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })

  await assert.rejects(
    () => authApi.loginAdmin('incorrect-key'),
    (error) => error.name === 'AdminLoginError' && error.message === '管理员密钥无效',
  )

  assert.equal(adminSession.getAdminAccessToken(), '')
  assert.equal(storedValues.size, 0)
})

test('受保护请求收到 303 后清除令牌并广播失效，不重放请求', async () => {
  adminSession.saveAdminSession({
    accessToken: 'expired-server-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  let invalidationReason = ''
  const unsubscribe = adminSession.subscribeToAdminSessionInvalidation((reason) => {
    invalidationReason = reason
  })

  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(null, {
      status: 303,
      headers: { Location: '/dev/flame/admin/api/auth/login' },
    })
  }

  await assert.rejects(
    () => httpClient.adminFetch('seasons', { method: 'POST', body: '{}' }),
    (error) => error.name === 'AdminAuthenticationRequiredError',
  )

  unsubscribe()
  assert.equal(requestCount, 1)
  assert.equal(invalidationReason, 'rejected')
  assert.equal(adminSession.getAdminAccessToken(), '')
})

test('当前赛季接口携带令牌，并将正式参赛人员聚合为等级饼图数据', async () => {
  adminSession.saveAdminSession({
    accessToken: 'current-season-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify({
        id: 7,
        name: '2026年8月赛季',
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        required_project_count: 3,
        status: 1,
        participants: [
          { season_user_id: 101, user_id: 'user-a', level_id: 2, level_name: '白银' },
          { season_user_id: 102, user_id: 'user-b', level_id: 2, level_name: '白银' },
          { season_user_id: 103, user_id: 'user-c', level_id: 3, level_name: '黄金' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const season = await currentSeasonApi.getCurrentSeason()
  const enrollmentView = currentSeasonDashboard.createLevelEnrollmentView(
    season.participants,
  )
  const overview = currentSeasonDashboard.createSeasonOverview(
    season,
    new Date(2026, 7, 12),
  )

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/season-statistics/current')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer current-season-token',
  )
  assert.deepEqual(
    enrollmentView.items.map(({ levelId, name, value }) => ({ levelId, name, value })),
    [
      { levelId: 2, name: '白银', value: 2 },
      { levelId: 3, name: '黄金', value: 1 },
    ],
  )
  assert.equal(season.participants[0].seasonUserId, 101)
  assert.deepEqual(enrollmentView.userIdsByLevel.白银, ['user-a', 'user-b'])
  assert.deepEqual(enrollmentView.seasonUserIdsByLevel.白银, [101, 102])
  assert.equal(overview.participantCount, 3)
  assert.equal(overview.progress, 39)
  assert.equal(overview.remainingDays, 19)
})

test('赛季列表接口携带令牌，并保留后端的稳定倒序', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify([
        {
          id: 2,
          name: ' 2026年9月赛季 ',
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          status: 2,
          status_name: '结算中',
        },
        {
          id: 1,
          name: '2026年8月赛季',
          start_date: '2026-08-01',
          end_date: '2026-08-31',
          status: 3,
          status_name: '已结束',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const seasons = await seasonListApi.getAllSeasons()

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/season/list')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer season-list-token',
  )
  assert.deepEqual(seasons, [
    {
      id: 2,
      name: '2026年9月赛季',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      status: 2,
      statusName: '结算中',
    },
    {
      id: 1,
      name: '2026年8月赛季',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 3,
      statusName: '已结束',
    },
  ])
})

test('赛季列表接口接受没有任何赛季的空数组', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  assert.deepEqual(await seasonListApi.getAllSeasons(), [])
})

test('新增赛季接口提交规范字段并适配服务端创建结果', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 8,
      name: '2026年9月赛季',
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      required_project_count: 3,
      status: 0,
      status_name: '未开始',
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const createdSeason = await seasonCreateApi.createSeason({
    name: ' 2026年9月赛季 ',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    requiredProjectCount: 3,
  })

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/season/create')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer season-create-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    name: '2026年9月赛季',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    required_project_count: 3,
  })
  assert.deepEqual(createdSeason, {
    id: 8,
    name: '2026年9月赛季',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    requiredProjectCount: 3,
    status: 0,
    statusName: '未开始',
  })
})

test('新增赛季冲突时保留后端安全提示且不自动重试', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({
      detail: '赛季开始日期必须晚于已有赛季的最晚结束日期',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    () => seasonCreateApi.createSeason({
      name: '冲突赛季',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      requiredProjectCount: 3,
    }),
    (error) => error.name === 'SeasonCreateRequestError'
      && error.status === 409
      && error.message === '赛季开始日期必须晚于已有赛季的最晚结束日期',
  )
  assert.equal(requestCount, 1)
})

test('新增赛季严格要求 201 且拒绝不匹配的响应字段', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const request = {
    name: '2026年9月赛季',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    requiredProjectCount: 3,
  }
  const responsePayload = {
    id: 8,
    name: '2026年9月赛季',
    start_date: '2026-09-01',
    end_date: '2026-09-30',
    required_project_count: 3,
    status: 0,
    status_name: '未开始',
  }

  globalThis.fetch = async () => new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => seasonCreateApi.createSeason(request),
    (error) => error.name === 'SeasonCreateRequestError' && error.status === 200,
  )

  globalThis.fetch = async () => new Response(JSON.stringify({
    ...responsePayload,
    required_project_count: 2,
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => seasonCreateApi.createSeason(request),
    (error) => error.name === 'SeasonCreateRequestError'
      && error.message.includes('无法识别'),
  )
})

test('赛季列表拒绝非法日期与重复主键', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: 2,
          name: 'A',
          start_date: '2026-02-30',
          end_date: '2026-03-31',
          status: 1,
          status_name: '进行中',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  await assert.rejects(
    () => seasonListApi.getAllSeasons(),
    (error) => error.name === 'SeasonListRequestError',
  )

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: 2,
          name: 'A',
          start_date: '2026-02-01',
          end_date: '2026-02-28',
          status: 3,
          status_name: '已结束',
        },
        {
          id: 2,
          name: 'B',
          start_date: '2026-01-01',
          end_date: '2026-01-31',
          status: 3,
          status_name: '已结束',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  await assert.rejects(
    () => seasonListApi.getAllSeasons(),
    (error) => error.name === 'SeasonListRequestError' && /\u91cd\u590d/.test(error.message),
  )
})

test('赛季列表拒绝非法状态或不匹配的状态名称', async () => {
  adminSession.saveAdminSession({
    accessToken: 'season-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: 3,
          name: '2026年10月赛季',
          start_date: '2026-10-01',
          end_date: '2026-10-31',
          status: 4,
          status_name: '异常',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  await assert.rejects(
    () => seasonListApi.getAllSeasons(),
    (error) => error.name === 'SeasonListRequestError',
  )

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: 2,
          name: '2026年9月赛季',
          start_date: '2026-09-01',
          end_date: '2026-09-30',
          status: 2,
          status_name: '已结束',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  await assert.rejects(
    () => seasonListApi.getAllSeasons(),
    (error) => error.name === 'SeasonListRequestError',
  )
})

test('挑战等级列表接口携带令牌，并保留后端的积分主键升序', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify([
        { id: 1, name: ' 青铜 ', reward: 100 },
        { id: 2, name: '白银', reward: 200 },
        { id: 3, name: '黄金', reward: 200 },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const levels = await projectLevelListApi.getAllProjectLevels()

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/project-level/list')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-level-list-token',
  )
  assert.deepEqual(levels, [
    { id: 1, name: '青铜', reward: 100 },
    { id: 2, name: '白银', reward: 200 },
    { id: 3, name: '黄金', reward: 200 },
  ])
})

test('挑战等级列表接受空数组，并拒绝非法积分与重复主键', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  assert.deepEqual(await projectLevelListApi.getAllProjectLevels(), [])

  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 1, name: '青铜', reward: -1 }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  await assert.rejects(
    () => projectLevelListApi.getAllProjectLevels(),
    (error) => error.name === 'ProjectLevelListRequestError',
  )

  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { id: 1, name: '青铜', reward: 100 },
      { id: 1, name: '白银', reward: 200 },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  await assert.rejects(
    () => projectLevelListApi.getAllProjectLevels(),
    (error) => error.name === 'ProjectLevelListRequestError' && /重复/.test(error.message),
  )
})

test('新增挑战等级接口提交规范字段并使用服务端生成的主键', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 4,
      name: '铂金',
      reward: 400,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const createdLevel = await projectLevelCreateApi.createProjectLevel({
    name: ' 铂金 ',
    reward: 400,
  })

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/project-level/create')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-level-create-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    name: '铂金',
    reward: 400,
  })
  assert.deepEqual(createdLevel, { id: 4, name: '铂金', reward: 400 })
})

test('新增挑战等级允许零积分，并保留服务端重名提示且不自动重试', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 5,
    name: '体验',
    reward: 0,
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
  assert.deepEqual(
    await projectLevelCreateApi.createProjectLevel({ name: '体验', reward: 0 }),
    { id: 5, name: '体验', reward: 0 },
  )

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({ detail: '挑战等级名称已存在' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  await assert.rejects(
    () => projectLevelCreateApi.createProjectLevel({ name: '青铜', reward: 100 }),
    (error) => error.name === 'ProjectLevelCreateRequestError'
      && error.status === 409
      && error.message === '挑战等级名称已存在',
  )
  assert.equal(requestCount, 1)
})

test('新增挑战等级拒绝越界请求与不匹配的成功响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({ id: 4, name: '铂金', reward: 401 }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    () => projectLevelCreateApi.createProjectLevel({ name: '铂金', reward: 4294967296 }),
    (error) => error.name === 'ProjectLevelCreateRequestError' && error.status === 422,
  )
  assert.equal(requestCount, 0)

  await assert.rejects(
    () => projectLevelCreateApi.createProjectLevel({ name: '铂金', reward: 400 }),
    (error) => error.name === 'ProjectLevelCreateRequestError'
      && error.message.includes('无法识别'),
  )
  assert.equal(requestCount, 1)
})

test('修改挑战等级奖励积分提交 PATCH 并采用服务端确认结果', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-update-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 2,
      name: '白银',
      reward: 260,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const updatedLevel = await projectLevelRewardUpdateApi.updateProjectLevelReward(2, 260)

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/project-level/2/reward',
  )
  assert.equal(capturedRequest.options.method, 'PATCH')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-level-update-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), { reward: 260 })
  assert.deepEqual(updatedLevel, { id: 2, name: '白银', reward: 260 })
})

test('修改等级积分保留配置窗口提示且拒绝越界或不一致响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-level-update-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({
      detail: '当前激活赛季的配置修改窗口已关闭',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  await assert.rejects(
    () => projectLevelRewardUpdateApi.updateProjectLevelReward(2, 260),
    (error) => error.name === 'ProjectLevelRewardUpdateRequestError'
      && error.status === 409
      && error.message === '当前激活赛季的配置修改窗口已关闭',
  )
  assert.equal(requestCount, 1)

  await assert.rejects(
    () => projectLevelRewardUpdateApi.updateProjectLevelReward(2, 4294967296),
    (error) => error.name === 'ProjectLevelRewardUpdateRequestError'
      && error.status === 422,
  )
  assert.equal(requestCount, 1)

  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 3,
    name: '白银',
    reward: 260,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => projectLevelRewardUpdateApi.updateProjectLevelReward(2, 260),
    (error) => error.name === 'ProjectLevelRewardUpdateRequestError'
      && error.message.includes('无法识别'),
  )
})

test('项目列表接口返回完整目录，数据看板只用启用项目建立报名视图', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify([
        {
          project_id: 1,
          project_name: '跑步/快走',
          description: '累计跑步里程，提升心肺能力',
          icon_url: '/running.png',
          status: 1,
        },
        {
          project_id: 2,
          project_name: '健身打卡',
          description: null,
          icon_url: null,
          status: 0,
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const projects = await projectListApi.getAllProjects()
  const completeCatalog = projectCatalog.createProjectCatalog(projects)
  const visibleProjects = projectCatalog.getVisibleProjectCatalog(completeCatalog)
  const emptyView = projectEnrollmentDashboard.createEmptyProjectEnrollmentView(visibleProjects)

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/project/list')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-list-token',
  )
  assert.deepEqual(projects, [
    {
      projectId: 1,
      projectName: '跑步/快走',
      description: '累计跑步里程，提升心肺能力',
      iconUrl: '/running.png',
      status: 1,
    },
    {
      projectId: 2,
      projectName: '健身打卡',
      description: null,
      iconUrl: null,
      status: 0,
    },
  ])
  assert.deepEqual(completeCatalog.map(
    ({ id, name, description, status }) => ({ id, name, description, status }),
  ), [
    {
      id: 1,
      name: '跑步/快走',
      description: '累计跑步里程，提升心肺能力',
      status: 1,
    },
    { id: 2, name: '健身打卡', description: null, status: 0 },
  ])
  assert.deepEqual(
    emptyView.items.map(({ id, name, iconUrl, value }) => ({ id, name, iconUrl, value })),
    [
      { id: 1, name: '跑步/快走', iconUrl: '/running.png', value: 0 },
    ],
  )
  assert.deepEqual(emptyView.membersByProject, {
    '跑步/快走': [],
  })
  assert.deepEqual(emptyView.projectProgressesByUserId, {})
})

test('项目列表接口接受空数组，并拒绝缺少状态或重复主键的响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  assert.deepEqual(await projectListApi.getAllProjects(), [])

  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      { project_id: 1, project_name: '跑步', description: null, icon_url: null },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  await assert.rejects(
    () => projectListApi.getAllProjects(),
    (error) => error.name === 'ProjectListRequestError',
  )

  globalThis.fetch = async () =>
    new Response(JSON.stringify([
      {
        project_id: 1,
        project_name: '跑步',
        description: '项目说明',
        icon_url: null,
        status: 1,
      },
      {
        project_id: 1,
        project_name: '健身',
        description: null,
        icon_url: null,
        status: 0,
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  await assert.rejects(
    () => projectListApi.getAllProjects(),
    (error) => error.name === 'ProjectListRequestError' && /重复/.test(error.message),
  )
})

test('创建运动项目使用四段 multipart 字段上传 WebP 并采用服务端生成的主键与图标地址', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const iconFile = new File([new Uint8Array([82, 73, 70, 70])], 'cycling.webp', {
    type: 'image/webp',
  })
  const draft = {
    project: {
      name: ' 骑行 ',
      description: '通过骑行提升心肺耐力',
      status: 0,
    },
    project_rules: [
      {
        level_id: 1,
        sub_desc: '建立稳定骑行习惯',
        rule_content: [{ label: '累计距离', value: '100km' }],
        rule_note: null,
        status: 1,
      },
      {
        level_id: 2,
        sub_desc: null,
        rule_content: [{ label: '累计距离', value: '180km' }],
        rule_note: '记录有效轨迹',
        status: 1,
      },
    ],
    project_upload_configs: [
      {
        record_type: '普通凭证',
        upload_hint: '上传骑行轨迹截图',
        note_example: null,
        sort_order: 0,
        status: 1,
      },
    ],
    icon_file: iconFile,
  }

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      project_id: 8,
      project_name: '骑行',
      description: '通过骑行提升心肺耐力',
      icon_url: '/project-97fc.webp',
      status: 0,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const createdProject = await projectCreateApi.createProject(draft)

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/project/create')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-create-token',
  )
  assert.equal(capturedRequest.options.headers.get('Content-Type'), null)
  assert.ok(capturedRequest.options.body instanceof FormData)
  assert.deepEqual(JSON.parse(capturedRequest.options.body.get('project')), {
    name: '骑行',
    description: '通过骑行提升心肺耐力',
    status: 0,
  })
  assert.deepEqual(
    JSON.parse(capturedRequest.options.body.get('project_rules')),
    draft.project_rules,
  )
  assert.deepEqual(
    JSON.parse(capturedRequest.options.body.get('project_upload_configs')),
    draft.project_upload_configs,
  )
  assert.equal(capturedRequest.options.body.get('icon_file').name, 'cycling.webp')
  assert.equal(capturedRequest.options.body.get('icon_file').type, 'image/webp')
  assert.deepEqual(createdProject, {
    id: 8,
    name: '骑行',
    description: '通过骑行提升心肺耐力',
    iconUrl: '/project-97fc.webp',
    status: 0,
  })
})

test('创建运动项目保留配置窗口提示，并在请求前拒绝非法规则结构', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const draft = {
    project: { name: '骑行', description: null, status: 0 },
    project_rules: [{
      level_id: 1,
      sub_desc: null,
      rule_content: [{ label: '累计距离', value: '100km' }],
      rule_note: null,
      status: 1,
    }],
    project_upload_configs: [{
      record_type: '普通凭证',
      upload_hint: '上传轨迹截图',
      note_example: null,
      sort_order: 0,
      status: 1,
    }],
    icon_file: new File([new Uint8Array([82, 73, 70, 70])], 'cycling.webp', {
      type: 'image/webp',
    }),
  }

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({
      detail: '当前激活赛季的配置修改窗口已关闭',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    () => projectCreateApi.createProject(draft),
    (error) => error.name === 'ProjectCreateRequestError'
      && error.status === 409
      && error.message === '当前激活赛季的配置修改窗口已关闭',
  )
  assert.equal(requestCount, 1)

  await assert.rejects(
    () => projectCreateApi.createProject({
      ...draft,
      icon_file: new File([new Uint8Array([137, 80, 78, 71])], 'cycling.png', {
        type: 'image/png',
      }),
    }),
    (error) => error.name === 'ProjectCreateRequestError'
      && error.status === 400
      && error.message.includes('WebP'),
  )
  assert.equal(requestCount, 1)

  await assert.rejects(
    () => projectCreateApi.createProject({
      ...draft,
      project_rules: [
        draft.project_rules[0],
        {
          ...draft.project_rules[0],
          level_id: 2,
          rule_content: [{ label: '累计时长', value: '20h' }],
        },
      ],
    }),
    (error) => error.name === 'ProjectCreateRequestError'
      && error.status === 409
      && error.message.includes('指标标签必须一致'),
  )
  assert.equal(requestCount, 1)
})

test('项目状态接口提交严格整数状态并采用完整服务端响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-status-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      project_id: 2,
      project_name: '健身打卡',
      description: '记录每日训练',
      icon_url: '/fitness.png',
      status: 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const project = await projectStatusUpdateApi.updateProjectStatus(2, 0)

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/project/2/status')
  assert.equal(capturedRequest.options.method, 'PATCH')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-status-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), { status: 0 })
  assert.deepEqual(project, {
    id: 2,
    name: '健身打卡',
    description: '记录每日训练',
    iconUrl: '/fitness.png',
    status: 0,
  })
})

test('项目状态接口保留配置窗口冲突并拒绝非严格状态', async () => {
  await assert.rejects(
    () => projectStatusUpdateApi.updateProjectStatus(2, true),
    (error) => error.name === 'ProjectStatusUpdateRequestError' && error.status === 422,
  )

  adminSession.saveAdminSession({
    accessToken: 'project-status-conflict-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () => new Response(JSON.stringify({
    detail: '当前激活赛季的配置修改窗口已关闭',
  }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.rejects(
    () => projectStatusUpdateApi.updateProjectStatus(2, 1),
    (error) => (
      error.name === 'ProjectStatusUpdateRequestError'
      && error.status === 409
      && error.message === '当前激活赛季的配置修改窗口已关闭'
    ),
  )
})

test('项目参赛人员接口编码参赛记录与项目 ID，并适配完成进度', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-participant-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify([{ user_id: 'user-1', completion_progress: 0.75 }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const records = await projectParticipantsApi.getProjectParticipants(101, 5)

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/season-statistics/project-participants?season_user_id=101&project_id=5',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-participant-token',
  )
  assert.deepEqual(records, [{ userId: 'user-1', completionProgress: 0.75 }])
})

test('项目参赛组合最多并发 5 个并聚合真实人数、等级和进度', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-participant-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const participants = Array.from({ length: 6 }, (_, index) => ({
    seasonUserId: 101 + index,
    userId: `user-${index + 1}`,
    levelId: index % 2 === 0 ? 2 : 3,
    levelName: index % 2 === 0 ? '白银' : '黄金',
  }))
  const projects = [
    { id: 5, name: '跑步/快走', value: 0, color: '#8579e4' },
    { id: 6, name: '健身打卡', value: 0, color: '#5aa9dc' },
  ]
  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  const attemptsByCombination = new Map()

  globalThis.fetch = async (url) => {
    const query = new URL(url, 'https://example.test').searchParams
    const seasonUserId = Number(query.get('season_user_id'))
    const projectId = Number(query.get('project_id'))
    const combination = `${seasonUserId}-${projectId}`
    const attempt = (attemptsByCombination.get(combination) ?? 0) + 1
    attemptsByCombination.set(combination, attempt)
    activeRequestCount += 1
    maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)

    await new Promise((resolve) => setTimeout(resolve, 8))
    activeRequestCount -= 1

    if (combination === '101-5' && attempt === 1) {
      return new Response(JSON.stringify({ detail: '数据库暂时不可用' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const participantIndex = seasonUserId - 101
    const hasRecord = projectId === 5 || participantIndex % 2 === 0
    return new Response(
      JSON.stringify(
        hasRecord
          ? [{
              user_id: `user-${participantIndex + 1}`,
              completion_progress: (participantIndex + 1) / 10,
            }]
          : [],
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const recordsByProjectId = await projectParticipantsLoader.loadProjectParticipantRecords(
    participants,
    projects,
    { retryDelayMs: 0 },
  )
  const userMembers = participants.map((participant, index) => ({
    id: participant.userId,
    name: `用户${index + 1}`,
    department: '研发部',
    avatarUrl: null,
  }))
  const enrollmentView = projectEnrollmentDashboard.createProjectEnrollmentView(
    projects,
    recordsByProjectId,
    userMembers,
  )

  assert.equal(maximumActiveRequestCount, 5)
  assert.equal(attemptsByCombination.get('101-5'), 2)
  assert.deepEqual(enrollmentView.items.map(({ id, value }) => ({ id, value })), [
    { id: 5, value: 6 },
    { id: 6, value: 3 },
  ])
  assert.equal(enrollmentView.membersByProject['跑步/快走'][0].level, '白银')
  assert.equal(enrollmentView.membersByProject['跑步/快走'][0].progress, 10)
  assert.deepEqual(
    enrollmentView.membersByProject.健身打卡.map((member) => member.id),
    ['user-1', 'user-3', 'user-5'],
  )
  assert.deepEqual(enrollmentView.projectProgressesByUserId['user-1'], [
    { projectId: 5, projectName: '跑步/快走', progress: 10 },
    { projectId: 6, projectName: '健身打卡', progress: 10 },
  ])
  assert.deepEqual(enrollmentView.projectProgressesByUserId['user-2'], [
    { projectId: 5, projectName: '跑步/快走', progress: 20 },
  ])

  const levelMembers = projectEnrollmentDashboard.attachProjectProgressesToMembers(
    userMembers.slice(0, 2),
    enrollmentView.projectProgressesByUserId,
  )
  assert.equal(levelMembers[0].projectProgresses.length, 2)
  assert.equal(levelMembers[1].projectProgresses[0].progress, 20)
})

test('待终审接口携带参赛记录参数并适配凭证字段', async () => {
  adminSession.saveAdminSession({
    accessToken: 'pending-review-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify([{
        id: 501,
        project_id: 5,
        image_url: '/proofs/501.jpg',
        created_at: '2026-08-12T10:30:45',
        proof_date: '2026-08-11',
        note: '晚间跑步 5 公里',
        review_comment: null,
      }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const records = await pendingFinalReviewApi.getPendingFinalReviews(101)

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/proof/pending-final-review?season_user_id=101',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer pending-review-token',
  )
  assert.deepEqual(records, [{
    id: 501,
    projectId: 5,
    imageUrl: '/proofs/501.jpg',
    createdAt: '2026-08-12T10:30:45',
    proofDate: '2026-08-11',
    note: '晚间跑步 5 公里',
    reviewComment: null,
  }])
})

test('项目等级规则接口编码组合 ID 并保留有序规则指标', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-rule-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      sub_desc: '提升有氧容量和节奏控制',
      rule_content: [
        { label: '累计距离', value: '50km' },
        { label: '配速要求', value: "≤8'00''" },
        { label: '单次时长', value: null },
      ],
      rule_note: '跑步或快走均可累计',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rule = await projectRuleApi.getProjectRule(2, 3)

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/project/rule?project_id=2&level_id=3',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-rule-token',
  )
  assert.deepEqual(rule, {
    subDesc: '提升有氧容量和节奏控制',
    ruleContent: [
      { label: '累计距离', value: '50km' },
      { label: '配速要求', value: "≤8'00''" },
      { label: '单次时长', value: null },
    ],
    ruleNote: '跑步或快走均可累计',
  })
})

test('新建等级初始化的空规则值可以建模为待设置指标', async () => {
  const catalog = projectRuleCatalog.createProjectRuleCatalog(async () => ({
    subDesc: null,
    ruleContent: [{ label: '累计距离', value: null }],
    ruleNote: null,
  }))

  const model = await catalog.load(2, 4)

  assert.deepEqual(model.metrics, [{ label: '累计距离', value: null }])
  assert.equal(model.subDesc, null)
  assert.equal(model.ruleNote, null)
  assert.equal(model.summary, '累计距离：待设置')
})

test('项目等级规则按 projectId 与 levelId 建模并复用缓存', async () => {
  let requestCount = 0
  const catalog = projectRuleCatalog.createProjectRuleCatalog(async () => {
    requestCount += 1
    await new Promise((resolve) => setTimeout(resolve, 8))
    return {
      subDesc: '提升有氧能力',
      ruleContent: [{ label: '累计距离', value: '50km' }],
      ruleNote: '跑步或快走均可累计',
    }
  })

  const [firstModel, concurrentModel] = await Promise.all([
    catalog.load(2, 3),
    catalog.load(2, 3),
  ])
  const cachedModel = await catalog.load(2, 3)

  assert.equal(requestCount, 1)
  assert.equal(firstModel, concurrentModel)
  assert.equal(firstModel, cachedModel)
  assert.deepEqual(firstModel, {
    key: '2:3',
    projectId: 2,
    levelId: 3,
    subDesc: '提升有氧能力',
    metrics: [{ label: '累计距离', value: '50km' }],
    ruleNote: '跑步或快走均可累计',
    summary: '累计距离：50km',
  })
})

test('单项目单等级规则修改提交完整配置并保留 JSON 指标值', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-rule-update-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      project_id: 2,
      level_id: 3,
      sub_desc: '提升有氧容量',
      rule_content: [
        { label: '累计距离', value: 50 },
        { label: '适用天气', value: ['晴', '阴'] },
        { label: '需定位', value: true },
      ],
      rule_note: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rule = await projectRuleUpdateApi.updateProjectRule(3, 2, {
    subDesc: '提升有氧容量',
    ruleContent: [
      { label: '累计距离', value: 50 },
      { label: '适用天气', value: ['晴', '阴'] },
      { label: '需定位', value: true },
    ],
    ruleNote: '',
  })

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/project-level/3/project/2/rule',
  )
  assert.equal(capturedRequest.options.method, 'PATCH')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-rule-update-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    sub_desc: '提升有氧容量',
    rule_content: [
      { label: '累计距离', value: 50 },
      { label: '适用天气', value: ['晴', '阴'] },
      { label: '需定位', value: true },
    ],
    rule_note: null,
  })
  assert.deepEqual(rule, {
    projectId: 2,
    levelId: 3,
    subDesc: '提升有氧容量',
    ruleContent: [
      { label: '累计距离', value: 50 },
      { label: '适用天气', value: ['晴', '阴'] },
      { label: '需定位', value: true },
    ],
    ruleNote: null,
  })
})

test('单等级指标修订可以只提交 rule_content 补丁', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-rule-values-only-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  let requestBody
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body)
    return new Response(JSON.stringify({
      project_id: 2,
      level_id: 3,
      sub_desc: '保持原副描述',
      rule_content: [{ label: '累计距离', value: 55 }],
      rule_note: '保持原备注',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await projectRuleUpdateApi.updateProjectRule(3, 2, {
    ruleContent: [{ label: '累计距离', value: 55 }],
  })

  assert.deepEqual(requestBody, {
    rule_content: [{ label: '累计距离', value: 55 }],
  })
})

test('单等级规则修改透传配置窗口冲突并拒绝重复指标标签', async () => {
  await assert.rejects(
    () => projectRuleUpdateApi.updateProjectRule(3, 2, {
      ruleContent: [
        { label: '累计距离', value: '50km' },
        { label: '累计距离', value: '60km' },
      ],
      subDesc: null,
      ruleNote: null,
    }),
    (error) => error.name === 'ProjectRuleUpdateRequestError' && error.status === 422,
  )

  adminSession.saveAdminSession({
    accessToken: 'project-rule-conflict-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () => new Response(JSON.stringify({
    detail: '当前激活赛季的配置修改窗口已关闭',
  }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.rejects(
    () => projectRuleUpdateApi.updateProjectRule(3, 2, {
      ruleContent: [{ label: '累计距离', value: '50km' }],
      subDesc: null,
      ruleNote: null,
    }),
    (error) => (
      error.name === 'ProjectRuleUpdateRequestError'
      && error.status === 409
      && error.message === '当前激活赛季的配置修改窗口已关闭'
    ),
  )
})

test('规则修改后原地更新共享组合模型引用', async () => {
  const catalog = projectRuleCatalog.createProjectRuleCatalog(async () => ({
    subDesc: '原副描述',
    ruleContent: [{ label: '累计距离', value: '30km' }],
    ruleNote: null,
  }))
  const originalModel = await catalog.load(2, 3)
  const updatedModel = catalog.set(2, 3, {
    subDesc: '新副描述',
    ruleContent: [{ label: '累计距离', value: '50km' }],
    ruleNote: '跑步或快走均可累计',
  })

  assert.equal(updatedModel, originalModel)
  assert.equal(catalog.get(2, 3), originalModel)
  assert.deepEqual(originalModel.metrics, [{ label: '累计距离', value: '50km' }])
  assert.equal(originalModel.subDesc, '新副描述')
  assert.equal(originalModel.ruleNote, '跑步或快走均可累计')
})

test('凭证图片接口只使用记录 ID，并校验返回图片媒体类型', async () => {
  adminSession.saveAdminSession({
    accessToken: 'proof-image-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(new Uint8Array([255, 216, 255]), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg' },
    })
  }

  const blob = await proofRecordImageApi.getProofRecordImage(115)

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/image/proof_record/115',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer proof-image-token',
  )
  assert.equal(blob.type, 'image/jpeg')
  assert.equal(blob.size, 3)
})

test('凭证图片按五张分批预取，越级点击只加载目标图片并限制并发', async () => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    queueIndex: index,
  }))
  const requestedIds = []
  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  const scheduler = proofRecordImageScheduler.createProofRecordImageScheduler({
    maxConcurrent: 3,
    retryDelayMs: 0,
    async requestImage(recordId) {
      requestedIds.push(recordId)
      activeRequestCount += 1
      maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)
      await new Promise((resolve) => setTimeout(resolve, 8))
      activeRequestCount -= 1
      return new Blob([recordId], { type: 'image/jpeg' })
    },
  })

  scheduler.initialize(records)
  scheduler.select(records[7])
  await scheduler.whenIdle()

  assert.deepEqual([...requestedIds].sort((a, b) => a - b), [1, 2, 3, 4, 5, 8])
  assert.equal(maximumActiveRequestCount, 3)

  scheduler.select(records[3])
  await scheduler.whenIdle()
  assert.deepEqual([...requestedIds].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

  scheduler.select(records[8])
  await scheduler.whenIdle()
  assert.deepEqual([...requestedIds].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

  scheduler.dispose()
})

test('凭证图片瞬时失败会自动重试，重复选择不会重复请求', async () => {
  let attempt = 0
  const loadedIds = []
  const scheduler = proofRecordImageScheduler.createProofRecordImageScheduler({
    retryDelayMs: 0,
    requestImage: async (recordId) => {
      attempt += 1
      if (attempt === 1) {
        throw new proofRecordImageApi.ProofRecordImageRequestError('暂时失败', 502)
      }
      return new Blob([recordId], { type: 'image/png' })
    },
    onLoaded: ({ record }) => loadedIds.push(record.id),
  })
  const records = [{ id: 1, queueIndex: 0 }]

  scheduler.initialize(records)
  scheduler.select(records[0])
  await scheduler.whenIdle()
  scheduler.select(records[0])
  await scheduler.whenIdle()

  assert.equal(attempt, 2)
  assert.deepEqual(loadedIds, [1])
  scheduler.dispose()
})

test('终审接口提交规范化评语，并适配拒绝后的进度事务结果', async () => {
  adminSession.saveAdminSession({
    accessToken: 'final-review-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      proof_record_id: 501,
      review_status: 'rejected',
      review_comment: '凭证不符合项目要求，终审未通过。',
      rolled_back_progress: 0.4,
      backfilled_progress: 0.25,
      completion_progress: 0.75,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await finalReviewApi.submitProofFinalReview({
    proofRecordId: 501,
    reviewComment: '  凭证不符合项目要求，终审未通过。  ',
    decision: 'rejected',
  })

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/proof/final-review')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer final-review-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    proof_record_id: 501,
    review_comment: '凭证不符合项目要求，终审未通过。',
    decision: 'rejected',
  })
  assert.deepEqual(result, {
    proofRecordId: 501,
    reviewStatus: 'rejected',
    reviewComment: '凭证不符合项目要求，终审未通过。',
    rolledBackProgress: 0.4,
    backfilledProgress: 0.25,
    completionProgress: 0.75,
  })
})

test('终审状态冲突时不自动重试并返回可识别提示', async () => {
  adminSession.saveAdminSession({
    accessToken: 'final-review-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({
      detail: '凭证已完成终审或当前状态不允许终审',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    () => finalReviewApi.submitProofFinalReview({
      proofRecordId: 501,
      reviewComment: '凭证符合项目要求，终审通过。',
      decision: 'approved',
    }),
    (error) => error.name === 'FinalReviewRequestError'
      && error.status === 409
      && error.message.includes('状态或项目进度已变化'),
  )
  assert.equal(requestCount, 1)
})

test('用户意见接口携带令牌，并将意见正文写入展示模型', async () => {
  adminSession.saveAdminSession({
    accessToken: 'suggestion-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify([{
      id: 12,
      user_name: '张三',
      content: ' 希望增加赛季结束前的项目进度提醒。 ',
      avatar_url: '/zhang-san.jpg',
      created_at: '2026-08-12T09:30:00',
    }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const suggestions = await suggestionListApi.getVisibleSuggestions()
  const view = userSuggestionDashboard.createUserSuggestionView(suggestions)

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/suggestion/list')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer suggestion-list-token',
  )
  assert.deepEqual(suggestions, [{
    id: 12,
    userName: '张三',
    content: '希望增加赛季结束前的项目进度提醒。',
    avatarUrl: '/zhang-san.jpg',
    createdAt: '2026-08-12T09:30:00',
  }])
  assert.deepEqual(view[0], {
    id: 12,
    marker: '张',
    title: '张三',
    description: '希望增加赛季结束前的项目进度提醒。',
    avatarUrl: '/zhang-san.jpg',
    avatarObjectUrl: undefined,
    avatarLoadFailed: false,
    createdAt: '2026-08-12T09:30:00',
    meta: '08月12日 09:30',
    status: '可见意见',
  })
})

test('用户意见接口接受没有可见记录的空数组', async () => {
  adminSession.saveAdminSession({
    accessToken: 'suggestion-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () => new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  assert.deepEqual(await suggestionListApi.getVisibleSuggestions(), [])
})

test('用户意见头像地址通过受保护中转接口加载图片', async () => {
  adminSession.saveAdminSession({
    accessToken: 'suggestion-avatar-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })
  }

  let loadedAvatar
  await memberAvatarLoader.loadMemberAvatars([{
    id: 12,
    avatarUrl: '/suggestions/zhang-san.png',
  }], {
    onAvatarLoaded: (result) => {
      loadedAvatar = result
    },
  })

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/image/avator?avatar_url=%2Fsuggestions%2Fzhang-san.png',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer suggestion-avatar-token',
  )
  assert.deepEqual(loadedAvatar.memberIds, [12])
  assert.equal(loadedAvatar.blob.type, 'image/png')
})

test('用户意见处理接口携带令牌并提交已优化动作', async () => {
  adminSession.saveAdminSession({
    accessToken: 'suggestion-process-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      suggestion_id: 12,
      processing_stage: 'resolved',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await suggestionProcessApi.processSuggestion({
    suggestionId: 12,
    action: 'resolved',
  })

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/suggestion/process')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer suggestion-process-token',
  )
  assert.equal(capturedRequest.options.headers.get('Content-Type'), 'application/json')
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    suggestion_id: 12,
    action: 'resolved',
  })
  assert.deepEqual(result, {
    suggestionId: 12,
    processingStage: 'resolved',
  })
})

test('用户意见处理冲突不自动重试并保留可识别错误', async () => {
  adminSession.saveAdminSession({
    accessToken: 'suggestion-process-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({
      detail: '意见已有不同处理结论，不能重复处理',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    () => suggestionProcessApi.processSuggestion({
      suggestionId: 12,
      action: 'rejected',
    }),
    (error) => error.name === 'SuggestionProcessRequestError'
      && error.status === 409
      && error.message.includes('不同处理结论'),
  )
  assert.equal(requestCount, 1)
})

test('全部奖品接口携带令牌并适配上架和下架商品', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-list-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify([
      {
        id: 1,
        name: ' 运动水杯 ',
        description: ' 运动补水 ',
        points_required: 50,
        image_url: '/运动水杯.jpg',
        status: 1,
      },
      {
        id: 2,
        name: '旧款跳绳',
        description: null,
        points_required: 30,
        image_url: null,
        status: 0,
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const products = await productListApi.getAllProducts()

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/product/list')
  assert.equal(capturedRequest.options.method, 'GET')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer product-list-token',
  )
  assert.deepEqual(products, [
    {
      id: 1,
      name: '运动水杯',
      description: '运动补水',
      pointsRequired: 50,
      imageUrl: '/运动水杯.jpg',
      status: 1,
    },
    {
      id: 2,
      name: '旧款跳绳',
      description: null,
      pointsRequired: 30,
      imageUrl: null,
      status: 0,
    },
  ])
})

test('全部奖品接口区分空列表并拒绝重复或异常商品', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-list-validation-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  globalThis.fetch = async () => new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  assert.deepEqual(await productListApi.getAllProducts(), [])

  globalThis.fetch = async () => new Response(JSON.stringify([
    {
      id: 1,
      name: '运动水杯',
      description: null,
      points_required: 50,
      image_url: null,
      status: 1,
    },
    {
      id: 1,
      name: '重复商品',
      description: null,
      points_required: 30,
      image_url: null,
      status: 0,
    },
  ]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.rejects(
    () => productListApi.getAllProducts(),
    (error) => error.name === 'ProductListRequestError' && error.message.includes('重复奖品'),
  )
})

test('新增奖品接口提交 WebP multipart 并采用服务端生成的主键与图片地址', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-create-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 12,
      name: '运动毛巾',
      description: '训练后快速吸汗',
      points_required: 80,
      image_url: '/product-6fd4f630049c4a7c8a4ad07054a2db1e.webp',
      status: 1,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const imageFile = new File([new Uint8Array([82, 73, 70, 70])], 'towel.webp', {
    type: 'image/webp',
  })
  const product = await productCreateApi.createProduct({
    name: ' 运动毛巾 ',
    pointsRequired: 80,
    description: ' 训练后快速吸汗 ',
    imageFile,
  })

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/product/create')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(capturedRequest.options.headers.get('Authorization'), 'Bearer product-create-token')
  assert.equal(capturedRequest.options.headers.get('Content-Type'), null)
  assert.ok(capturedRequest.options.body instanceof FormData)
  assert.equal(capturedRequest.options.body.get('name'), '运动毛巾')
  assert.equal(capturedRequest.options.body.get('points_required'), '80')
  assert.equal(capturedRequest.options.body.get('description'), '训练后快速吸汗')
  assert.equal(capturedRequest.options.body.get('image').name, 'towel.webp')
  assert.equal(capturedRequest.options.body.get('image').type, 'image/webp')
  assert.deepEqual(product, {
    id: 12,
    name: '运动毛巾',
    description: '训练后快速吸汗',
    pointsRequired: 80,
    imageUrl: '/product-6fd4f630049c4a7c8a4ad07054a2db1e.webp',
    status: 1,
  })
})

test('新增奖品拒绝缺图与非 WebP，并识别 502 部分成功', async () => {
  await assert.rejects(
    () => productCreateApi.createProduct({
      name: '运动毛巾',
      pointsRequired: 80,
      description: '',
      imageFile: null,
    }),
    (error) => error.name === 'ProductCreateRequestError' && error.status === 422,
  )
  await assert.rejects(
    () => productCreateApi.createProduct({
      name: '运动毛巾',
      pointsRequired: 80,
      description: '',
      imageFile: new File([new Uint8Array([137, 80, 78, 71])], 'towel.png', {
        type: 'image/png',
      }),
    }),
    (error) => error.name === 'ProductCreateRequestError' && error.status === 400,
  )

  adminSession.saveAdminSession({
    accessToken: 'product-create-error-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () => new Response(JSON.stringify({
    detail: '奖品已创建，但图片存储失败：商品图片服务不可用',
  }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.rejects(
    () => productCreateApi.createProduct({
      name: '运动毛巾',
      pointsRequired: 80,
      description: '',
      imageFile: new File([new Uint8Array([82, 73, 70, 70])], 'towel.webp', {
        type: 'image/webp',
      }),
    }),
    (error) => error.name === 'ProductCreateRequestError'
      && error.status === 502
      && error.partiallyApplied === true
      && error.message.includes('奖品已创建'),
  )
})

test('奖品状态接口提交严格整数状态并采用服务端完整响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-status-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 2,
      name: '运动水杯',
      description: '运动补水',
      points_required: 50,
      image_url: '/运动水杯.jpg',
      status: 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const product = await productStatusUpdateApi.updateProductStatus(2, 0)

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/product/2/status')
  assert.equal(capturedRequest.options.method, 'PATCH')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer product-status-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), { status: 0 })
  assert.deepEqual(product, {
    id: 2,
    name: '运动水杯',
    description: '运动补水',
    pointsRequired: 50,
    imageUrl: '/运动水杯.jpg',
    status: 0,
  })
})

test('奖品状态接口保留安全错误，并拒绝非法状态与不一致响应', async () => {
  await assert.rejects(
    () => productStatusUpdateApi.updateProductStatus(2, true),
    (error) => error.name === 'ProductStatusUpdateRequestError' && error.status === 422,
  )

  adminSession.saveAdminSession({
    accessToken: 'product-status-error-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: '奖品不存在' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => productStatusUpdateApi.updateProductStatus(2, 1),
    (error) => (
      error.name === 'ProductStatusUpdateRequestError'
      && error.status === 404
      && error.message === '奖品不存在'
    ),
  )

  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 2,
    name: '运动水杯',
    description: null,
    points_required: 50,
    image_url: null,
    status: 0,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => productStatusUpdateApi.updateProductStatus(2, 1),
    (error) => (
      error.name === 'ProductStatusUpdateRequestError'
      && error.message.includes('无法识别')
    ),
  )
})

test('奖品信息修改接口使用 multipart 提交局部字段与 WebP 并采用完整响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-update-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 7,
      name: 'Keep 弹力带',
      description: null,
      points_required: 80,
      image_url: '/product-9ee5f1ccf70d4c7ea6711fcb8956461d.webp',
      status: 1,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const imageFile = new File([new Uint8Array([82, 73, 70, 70])], 'keep-band.webp', {
    type: 'image/webp',
  })
  const product = await productUpdateApi.updateProduct(7, {
    name: ' Keep 弹力带 ',
    pointsRequired: 80,
    description: null,
    imageFile,
  })

  assert.equal(capturedRequest.url, '/dev/flame/admin/api/product/7')
  assert.equal(capturedRequest.options.method, 'PATCH')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer product-update-token',
  )
  assert.equal(capturedRequest.options.headers.get('Content-Type'), null)
  assert.ok(capturedRequest.options.body instanceof FormData)
  assert.deepEqual(JSON.parse(capturedRequest.options.body.get('product')), {
    name: 'Keep 弹力带',
    points_required: 80,
    description: null,
  })
  assert.equal(capturedRequest.options.body.get('image').name, 'keep-band.webp')
  assert.equal(capturedRequest.options.body.get('image').type, 'image/webp')
  assert.deepEqual(product, {
    id: 7,
    name: 'Keep 弹力带',
    description: null,
    pointsRequired: 80,
    imageUrl: '/product-9ee5f1ccf70d4c7ea6711fcb8956461d.webp',
    status: 1,
  })
})

test('奖品信息修改拒绝空补丁、非法类型和非 WebP 图片', async () => {
  await assert.rejects(
    () => productUpdateApi.updateProduct(7, {}),
    (error) => error.name === 'ProductUpdateRequestError' && error.status === 422,
  )
  await assert.rejects(
    () => productUpdateApi.updateProduct(7, { pointsRequired: '80' }),
    (error) => error.name === 'ProductUpdateRequestError' && error.status === 422,
  )
  await assert.rejects(
    () => productUpdateApi.updateProduct(7, {
      imageFile: new File([new Uint8Array([137, 80, 78, 71])], 'product.png', {
        type: 'image/png',
      }),
    }),
    (error) => error.name === 'ProductUpdateRequestError' && error.status === 400,
  )
  await assert.rejects(
    () => productUpdateApi.updateProduct(7, { status: 0 }),
    (error) => error.name === 'ProductUpdateRequestError' && error.status === 422,
  )
})

test('奖品信息修改支持只上传图片且不发送空 product 字段', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-image-update-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  let capturedBody
  globalThis.fetch = async (_url, options) => {
    capturedBody = options.body
    return new Response(JSON.stringify({
      id: 7,
      name: 'Keep 弹力带',
      description: '居家力量训练',
      points_required: 80,
      image_url: '/product-aabbccddeeff00112233445566778899.webp',
      status: 1,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await productUpdateApi.updateProduct(7, {
    imageFile: new File([new Uint8Array([82, 73, 70, 70])], 'replacement.webp', {
      type: 'image/webp',
    }),
  })

  assert.equal(capturedBody.has('product'), false)
  assert.equal(capturedBody.get('image').name, 'replacement.webp')
  assert.equal(capturedBody.get('image').type, 'image/webp')
})

test('奖品信息修改识别 502 部分成功并保留配置窗口提示', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-update-error-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () => new Response(JSON.stringify({
    detail: '奖品基本信息已更新，但图片替换失败：商品图片文件不存在',
  }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  })

  await assert.rejects(
    () => productUpdateApi.updateProduct(7, {
      imageFile: new File([new Uint8Array([82, 73, 70, 70])], 'new-product.webp', {
        type: 'image/webp',
      }),
    }),
    (error) => (
      error.name === 'ProductUpdateRequestError'
      && error.status === 502
      && error.partiallyApplied === true
      && error.message.includes('基本信息已更新')
    ),
  )

  globalThis.fetch = async () => new Response(JSON.stringify({
    detail: '当前激活赛季的配置修改窗口已关闭',
  }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => productUpdateApi.updateProduct(7, { pointsRequired: 90 }),
    (error) => (
      error.name === 'ProductUpdateRequestError'
      && error.status === 409
      && error.partiallyApplied === false
      && error.message === '当前激活赛季的配置修改窗口已关闭'
    ),
  )
})

test('奖品列表图片每批最多 5 个，去重地址并指数退避重试瞬时错误', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-list-image-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  const attemptsByImageUrl = new Map()
  const requestOrder = []
  globalThis.fetch = async (url) => {
    const imageUrl = new URL(url, 'https://example.test').searchParams.get('image_url')
    requestOrder.push(imageUrl)
    const attempt = (attemptsByImageUrl.get(imageUrl) ?? 0) + 1
    attemptsByImageUrl.set(imageUrl, attempt)
    activeRequestCount += 1
    maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)
    await new Promise((resolve) => setTimeout(resolve, 8))
    activeRequestCount -= 1

    if (imageUrl === '/product-1.png' && attempt === 1) {
      return new Response(JSON.stringify({ detail: '商品图片服务暂时不可用' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (imageUrl === '/missing.png') {
      return new Response(JSON.stringify({ detail: '商品图片文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })
  }

  const loadedProductIds = []
  const failedProductIds = []
  const products = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    imageUrl: `/product-${index + 1}.png`,
  }))
  products.push({ id: 9, imageUrl: '/product-2.png' }, { id: 10, imageUrl: '/missing.png' })

  await productImageLoader.loadProductImages(products, {
    retryDelayMs: 0,
    onImageLoaded: ({ productIds }) => loadedProductIds.push(...productIds),
    onImageFailed: ({ productIds }) => failedProductIds.push(...productIds),
  })

  assert.equal(maximumActiveRequestCount, 5)
  assert.equal(attemptsByImageUrl.get('/product-1.png'), 2)
  assert.equal(attemptsByImageUrl.get('/product-2.png'), 1)
  assert.equal(attemptsByImageUrl.get('/missing.png'), 1)
  assert.deepEqual(requestOrder.slice(0, 5), [
    '/product-1.png',
    '/product-2.png',
    '/product-3.png',
    '/product-4.png',
    '/product-5.png',
  ])
  assert.ok(requestOrder.indexOf('/product-6.png') > requestOrder.lastIndexOf('/product-1.png'))
  assert.deepEqual(loadedProductIds.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.deepEqual(failedProductIds, [10])
})

test('待发放奖品接口携带令牌并保留后端流水顺序', async () => {
  adminSession.saveAdminSession({
    accessToken: 'reward-delivery-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify([
      {
        id: 31,
        user_id: 'user-1',
        product_id: 5,
        description: '兑换商品：运动水杯',
        created_at: '2026-08-12T09:30:00',
      },
      {
        id: 32,
        user_id: 'user-2',
        product_id: 6,
        description: null,
        created_at: '2026-08-12T09:35:00',
      },
    ]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const distributions = await pendingDistributionsApi.getPendingDistributions()

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/product/pending-distributions',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer reward-delivery-token',
  )
  assert.deepEqual(distributions.map((item) => item.id), [31, 32])
  assert.deepEqual(distributions[0], {
    id: 31,
    userId: 'user-1',
    productId: 5,
    description: '兑换商品：运动水杯',
    createdAt: '2026-08-12T09:30:00',
  })
})

test('奖品信息接口编码商品 ID 并适配历史下架商品资料', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-info-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      name: '运动水杯',
      description: '运动补水',
      image_url: '/products/bottle.png',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  assert.deepEqual(await productInfoApi.getProductInfo(5), {
    id: 5,
    name: '运动水杯',
    description: '运动补水',
    imageUrl: '/products/bottle.png',
  })
  assert.equal(capturedRequest.url, '/dev/flame/admin/api/product/info?product_id=5')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer product-info-token',
  )
})

test('奖品图片接口只在调用时编码图片地址并校验媒体类型', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-image-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  let capturedRequest
  globalThis.fetch = async (url, options) => {
    requestCount += 1
    capturedRequest = { url, options }
    return new Response(new Uint8Array([255, 216, 255]), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg' },
    })
  }

  assert.equal(requestCount, 0)
  const imageBlob = await productImageApi.getProductImage('/Keep 弹力带.jpg')

  assert.equal(requestCount, 1)
  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/image/product?image_url=%2FKeep+%E5%BC%B9%E5%8A%9B%E5%B8%A6.jpg',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer product-image-token',
  )
  assert.equal(imageBlob.type, 'image/jpeg')
})

test('礼品发放审核接口显式提交发放决定并校验服务端最终状态', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-distribution-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 31,
      gift_distribution_status: 'distributed',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  assert.deepEqual(
    await productDistributionApi.reviewProductDistribution(31, 'distributed'),
    { id: 31, giftDistributionStatus: 'distributed' },
  )
  assert.equal(capturedRequest.url, '/dev/flame/admin/api/product/distribute')
  assert.equal(capturedRequest.options.method, 'POST')
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer product-distribution-token',
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    id: 31,
    decision: 'distributed',
  })
})

test('礼品发放审核可以拒绝并校验拒绝终态', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-distribution-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(JSON.stringify({
      id: 31,
      gift_distribution_status: 'rejected',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  assert.deepEqual(
    await productDistributionApi.reviewProductDistribution(31, 'rejected'),
    { id: 31, giftDistributionStatus: 'rejected' },
  )
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    id: 31,
    decision: 'rejected',
  })
})

test('礼品发放审核结论冲突不自动重试并返回可识别错误', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-distribution-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return new Response(JSON.stringify({
      detail: '礼品发放状态异常，无法更新',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await assert.rejects(
    () => productDistributionApi.reviewProductDistribution(31, 'rejected'),
    (error) => error.name === 'ProductDistributionRequestError'
      && error.status === 409
      && error.message.includes('不同处理结论'),
  )
  assert.equal(requestCount, 1)
})

test('奖品目录去重商品 ID、限制并发并复用已取得资料', async () => {
  adminSession.saveAdminSession({
    accessToken: 'product-catalog-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let activeRequests = 0
  let maxActiveRequests = 0
  let requestCount = 0
  globalThis.fetch = async (url) => {
    requestCount += 1
    activeRequests += 1
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
    await new Promise((resolve) => window.setTimeout(resolve, 5))
    activeRequests -= 1
    const productId = Number(new URL(url, 'http://localhost').searchParams.get('product_id'))
    return new Response(JSON.stringify({
      name: `奖品 ${productId}`,
      description: null,
      image_url: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const catalog = productInfoCatalog.createProductInfoCatalog()
  const products = await catalog.getOrLoad([1, 2, 3, 4, 5, 6, 7, 8, 1])
  assert.equal(products.length, 8)
  assert.equal(requestCount, 8)
  assert.equal(maxActiveRequests, 5)

  await catalog.getOrLoad([8, 1])
  assert.equal(requestCount, 8)
})

test('全局用户目录只查询尚未保存的兑换用户并组合待发放视图', async () => {
  adminSession.saveAdminSession({
    accessToken: 'reward-user-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const requestedUserIdGroups = []
  globalThis.fetch = async (url) => {
    const userIds = new URL(url, 'http://localhost').searchParams.getAll('user_ids')
    requestedUserIdGroups.push(userIds)
    return new Response(JSON.stringify(userIds.map((userId) => ({
      user_id: userId,
      name: userId === 'user-1' ? '张三' : `用户 ${userId}`,
      department_name: '研发部',
      avatar_url: userId === 'user-1' ? '/avatars/user-1.png' : null,
    }))), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const catalog = userProfileCatalog.createUserProfileCatalog()
  await catalog.getOrLoad(['user-1', 'user-2'])
  const members = await catalog.getOrLoad(['user-2', 'user-3'])
  assert.deepEqual(requestedUserIdGroups, [
    ['user-1', 'user-2'],
    ['user-3'],
  ])

  const view = rewardDeliveryDashboard.createRewardDeliveryView([
    {
      id: 31,
      userId: 'user-1',
      productId: 5,
      description: '兑换商品：运动水杯',
      createdAt: '2026-08-12T09:30:00',
    },
  ], await catalog.getOrLoad(['user-1']), [{
    id: 5,
    name: '运动水杯',
    description: '运动补水',
    imageUrl: '/products/bottle.png',
  }])

  assert.equal(view[0].title, '张三 · 运动水杯')
  assert.equal(view[0].description, '研发部')
  assert.equal(view[0].detail.description, '运动补水')
  assert.equal(view[0].avatarUrl, '/avatars/user-1.png')
  assert.equal(view[0].meta, '08月12日 09:30')
  assert.equal(requestedUserIdGroups.length, 2)
  assert.deepEqual(members.map((member) => member.id), ['user-2', 'user-3'])
})

test('全局用户目录建立 season_user_id 到结算用户资料的稳定关系', async () => {
  const catalog = userProfileCatalog.createUserProfileCatalog()
  catalog.saveSeasonUserProfiles([
    {
      seasonUserId: 78,
      userId: 'user-78',
      userName: '张三',
      departmentName: '研发部',
      avatarUrl: '/avatar/user-78.webp',
    },
    {
      seasonUserId: 79,
      userId: 'user-79',
      userName: '李四',
      departmentName: '产品部',
      avatarUrl: null,
    },
  ])

  assert.deepEqual(catalog.getUserBySeasonUserId(78), {
    id: 'user-78',
    name: '张三',
    department: '研发部',
    avatarUrl: '/avatar/user-78.webp',
  })
  assert.deepEqual(
    catalog.getUsersBySeasonUserIds([79, 78, 404]).map((entry) => ({
      seasonUserId: entry.seasonUserId,
      userId: entry.userId,
    })),
    [
      { seasonUserId: 79, userId: 'user-79' },
      { seasonUserId: 78, userId: 'user-78' },
    ],
  )

  // 结算接口已写入的用户可以直接复用，不应再次进入用户详情请求。
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('不应重复请求用户详情')
  }
  try {
    const cachedMembers = await catalog.getOrLoad(['user-78', 'user-79'])
    assert.deepEqual(cachedMembers.map((member) => member.id), ['user-78', 'user-79'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('赛季参赛记录归属冲突时整批关系都不写入', () => {
  const catalog = userProfileCatalog.createUserProfileCatalog()
  catalog.linkSeasonUsers([{ seasonUserId: 78, userId: 'user-78' }])
  catalog.save([{ id: 'user-79', name: '李四', department: '产品部', avatarUrl: null }])

  assert.throws(
    () => catalog.linkSeasonUsers([
      { seasonUserId: 79, userId: 'user-79' },
      { seasonUserId: 78, userId: 'another-user' },
    ]),
    /用户归属不一致/,
  )
  assert.equal(catalog.getUserBySeasonUserId(79), null)

  catalog.clear()
  assert.equal(catalog.getUserBySeasonUserId(78), null)
})

test('待终审记录最多并发 5 个、重试瞬时错误并按全局口径倒序', async () => {
  adminSession.saveAdminSession({
    accessToken: 'pending-review-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const participants = Array.from({ length: 6 }, (_, index) => ({
    seasonUserId: 101 + index,
    userId: `user-${index + 1}`,
    levelId: 2,
    levelName: '白银',
  }))
  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  const attemptsBySeasonUserId = new Map()

  globalThis.fetch = async (url) => {
    const query = new URL(url, 'https://example.test').searchParams
    const seasonUserId = Number(query.get('season_user_id'))
    const attempt = (attemptsBySeasonUserId.get(seasonUserId) ?? 0) + 1
    attemptsBySeasonUserId.set(seasonUserId, attempt)
    activeRequestCount += 1
    maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)
    await new Promise((resolve) => setTimeout(resolve, 8))
    activeRequestCount -= 1

    if (seasonUserId === 101 && attempt === 1) {
      return new Response(JSON.stringify({ detail: '服务暂时不可用' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const index = seasonUserId - 101
    const proofDate = index === 0 ? '2026-08-11' : '2026-08-12'
    const createdAt = index < 2 ? '2026-08-12T10:30:45' : '2026-08-12T12:30:45'
    return new Response(JSON.stringify([{
      id: 501 + index,
      project_id: 5,
      image_url: `/proofs/${501 + index}.jpg`,
      created_at: createdAt,
      proof_date: proofDate,
      note: index === 0 ? '完成跑步' : null,
      review_comment: '初审通过',
    }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const records = await pendingFinalReviewLoader.loadPendingFinalReviewRecords(
    participants,
    { retryDelayMs: 0 },
  )
  const view = pendingFinalReviewDashboard.createPendingFinalReviewView(
    records,
    [{ id: 5, name: '跑步/快走' }],
    participants.map((participant, index) => ({
      id: participant.userId,
      name: `用户${index + 1}`,
      department: '研发部',
      avatarUrl: `/avatars/user-${index + 1}.jpg`,
      avatarObjectUrl: index === 5 ? 'blob:avatar-user-6' : undefined,
    })),
  )

  assert.equal(maximumActiveRequestCount, 5)
  assert.equal(attemptsBySeasonUserId.get(101), 2)
  assert.deepEqual(records.map((record) => record.id), [506, 505, 504, 503, 502, 501])
  assert.equal(view[0].userName, '用户6')
  assert.equal(view[0].projectName, '跑步/快走')
  assert.equal(view[0].levelId, 2)
  assert.equal(view[0].challengeLevel, '白银')
  assert.equal(view[0].ruleKey, '5:2')
  assert.equal(view[0].createdAtDateLabel, '2026-08-12')
  assert.equal(view[0].proofDateLabel, '08.12')
  assert.equal(view[0].avatarUrl, '/avatars/user-6.jpg')
  assert.equal(view[0].avatarObjectUrl, 'blob:avatar-user-6')
})

test('用户详细信息接口使用重复查询参数并适配姓名、部门和头像', async () => {
  adminSession.saveAdminSession({
    accessToken: 'user-info-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(
      JSON.stringify([
        {
          user_id: 'user-1',
          name: '张三',
          department_name: '研发部',
          avatar_url: '/avatar/user-1.jpg',
        },
        {
          user_id: 'user-2',
          name: '李四',
          department_name: '产品部',
          avatar_url: null,
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const users = await userInfoApi.getUserInfo([' user-1 ', 'user-2', 'user-1'])

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/user/user-info?user_ids=user-1&user_ids=user-2',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer user-info-token',
  )
  assert.deepEqual(users, [
    {
      userId: 'user-1',
      name: '张三',
      departmentName: '研发部',
      avatarUrl: '/avatar/user-1.jpg',
    },
    {
      userId: 'user-2',
      name: '李四',
      departmentName: '产品部',
      avatarUrl: null,
    },
  ])
})

test('等级人员超过 50 人时按接口上限顺序分批查询', async () => {
  adminSession.saveAdminSession({
    accessToken: 'user-info-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  const batchSizes = []
  globalThis.fetch = async (url) => {
    const query = new URL(url, 'https://example.test').searchParams
    const userIds = query.getAll('user_ids')
    batchSizes.push(userIds.length)

    return new Response(
      JSON.stringify(
        userIds.map((userId) => ({
          user_id: userId,
          name: `用户 ${userId}`,
          department_name: '研发部',
          avatar_url: null,
        })),
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const userIds = Array.from({ length: 51 }, (_, index) => `user-${index + 1}`)
  const members = await levelEnrollmentMembers.loadLevelEnrollmentMembers(userIds)

  assert.deepEqual(batchSizes, [50, 1])
  assert.equal(members.length, 51)
  assert.equal(members[0].id, 'user-1')
  assert.equal(members[50].id, 'user-51')
})

test('头像接口编码相对地址并返回经过媒体类型校验的图片 Blob', async () => {
  adminSession.saveAdminSession({
    accessToken: 'avatar-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })
  }

  const blob = await avatarApi.getAvatarImage('/avatar/user-1.jpg')

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/image/avator?avatar_url=%2Favatar%2Fuser-1.jpg',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer avatar-token',
  )
  assert.equal(blob.type, 'image/png')
  assert.equal(blob.size, 4)
})

test('项目图标接口保留历史路径并返回经过媒体类型校验的图片 Blob', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-icon-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let capturedRequest
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options }
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'Content-Type': 'image/png; charset=binary' },
    })
  }

  const blob = await projectIconApi.getProjectIconImage(
    '/project_icon/running icon.png',
  )

  assert.equal(
    capturedRequest.url,
    '/dev/flame/admin/api/image/project_icon?icon_url=%2Fproject_icon%2Frunning+icon.png',
  )
  assert.equal(
    capturedRequest.options.headers.get('Authorization'),
    'Bearer project-icon-token',
  )
  assert.equal(blob.type, 'image/png;charset=binary')
  assert.equal(blob.size, 4)
})

test('项目图标加载最多并发 5 个，去重相同地址并重试瞬时错误', async () => {
  adminSession.saveAdminSession({
    accessToken: 'project-icon-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  const attemptsByIconUrl = new Map()
  globalThis.fetch = async (url) => {
    const iconUrl = new URL(url, 'https://example.test').searchParams.get('icon_url')
    const attempt = (attemptsByIconUrl.get(iconUrl) ?? 0) + 1
    attemptsByIconUrl.set(iconUrl, attempt)
    activeRequestCount += 1
    maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)

    await new Promise((resolve) => setTimeout(resolve, 8))
    activeRequestCount -= 1

    if (iconUrl === '/icon-1.png' && attempt === 1) {
      return new Response(JSON.stringify({ detail: '项目图标服务暂时不可用' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (iconUrl === '/missing.png') {
      return new Response(JSON.stringify({ detail: '项目图标文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    })
  }

  const loadedProjectIds = []
  const failedProjectIds = []
  const projects = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    iconUrl: `/icon-${index + 1}.png`,
  }))
  projects.push({ id: 9, iconUrl: '/icon-2.png' }, { id: 10, iconUrl: '/missing.png' })

  await projectIconLoader.loadProjectIcons(projects, {
    retryDelayMs: 0,
    onIconLoaded: ({ projectIds }) => loadedProjectIds.push(...projectIds),
    onIconFailed: ({ projectIds }) => failedProjectIds.push(...projectIds),
  })

  assert.equal(maximumActiveRequestCount, 5)
  assert.equal(attemptsByIconUrl.get('/icon-1.png'), 2)
  assert.equal(attemptsByIconUrl.get('/icon-2.png'), 1)
  assert.equal(attemptsByIconUrl.get('/missing.png'), 1)
  assert.deepEqual(loadedProjectIds.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.deepEqual(failedProjectIds, [10])
})

test('头像加载最多并发 5 个，并对瞬时服务异常执行自动重试', async () => {
  adminSession.saveAdminSession({
    accessToken: 'avatar-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })

  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  const attemptsByAvatarUrl = new Map()
  globalThis.fetch = async (url) => {
    const avatarUrl = new URL(url, 'https://example.test').searchParams.get('avatar_url')
    const attempt = (attemptsByAvatarUrl.get(avatarUrl) ?? 0) + 1
    attemptsByAvatarUrl.set(avatarUrl, attempt)
    activeRequestCount += 1
    maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)

    await new Promise((resolve) => setTimeout(resolve, 8))
    activeRequestCount -= 1

    if (avatarUrl === '/avatar/user-1.jpg' && attempt === 1) {
      return new Response(JSON.stringify({ detail: '客户端后端头像服务不可用' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (avatarUrl === '/avatar/user-7.jpg') {
      return new Response(JSON.stringify({ detail: '头像文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg' },
    })
  }

  const loadedMemberIds = []
  const failedMemberIds = []
  const members = Array.from({ length: 7 }, (_, index) => ({
    id: `user-${index + 1}`,
    avatarUrl: `/avatar/user-${index + 1}.jpg`,
  }))
  await memberAvatarLoader.loadMemberAvatars(members, {
    retryDelayMs: 0,
    onAvatarLoaded({ memberIds }) {
      loadedMemberIds.push(...memberIds)
    },
    onAvatarFailed({ memberIds }) {
      failedMemberIds.push(...memberIds)
    },
  })

  assert.equal(maximumActiveRequestCount, 5)
  assert.equal(attemptsByAvatarUrl.get('/avatar/user-1.jpg'), 2)
  assert.equal(attemptsByAvatarUrl.get('/avatar/user-7.jpg'), 1)
  assert.equal(loadedMemberIds.length, 6)
  assert.deepEqual(failedMemberIds, ['user-7'])
})

test('当前赛季接口返回错误码时抛出可识别错误', async () => {
  adminSession.saveAdminSession({
    accessToken: 'current-season-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: '当前没有激活的赛季' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })

  await assert.rejects(
    () => currentSeasonApi.getCurrentSeason(),
    (error) =>
      error.name === 'CurrentSeasonRequestError' &&
      error.status === 404 &&
      error.message === '当前没有激活的赛季',
  )
})

test('当前赛季接口缺少参赛记录 ID 时拒绝不完整响应', async () => {
  adminSession.saveAdminSession({
    accessToken: 'current-season-token',
    tokenType: 'bearer',
    expiresIn: 28800,
  })
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: 7,
        name: '2026年8月赛季',
        start_date: '2026-08-01',
        end_date: '2026-08-31',
        required_project_count: 3,
        status: 1,
        participants: [
          { user_id: 'user-a', level_id: 2, level_name: '白银' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  await assert.rejects(
    () => currentSeasonApi.getCurrentSeason(),
    (error) =>
      error.name === 'CurrentSeasonRequestError' &&
      error.message === '当前赛季接口返回了无法识别的参赛人员数据',
  )
})
