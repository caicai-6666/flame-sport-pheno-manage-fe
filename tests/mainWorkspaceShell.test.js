import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createServer } from 'vite'

test('主工作台可以完成初始化渲染', async () => {
  const viteServer = await createServer({
    mode: 'development',
    server: { middlewareMode: true },
    appType: 'custom',
  })

  try {
    // 构建不会执行 setup，SSR 冒烟测试用于捕获登录后才出现的未定义变量等初始化错误。
    const workspaceModule = await viteServer.ssrLoadModule(
      '/src/components/layout/MainWorkspaceShell.vue',
    )
    const seasonCreateSheetModule = await viteServer.ssrLoadModule(
      '/src/components/configuration/SeasonCreateSheet.vue',
    )
    const enrollmentFlipCardModule = await viteServer.ssrLoadModule(
      '/src/components/dashboard/EnrollmentFlipCard.vue',
    )
    const layoutPreloader = await viteServer.ssrLoadModule(
      '/src/services/dashboardLayoutPreloader.js',
    )
    const layoutModules = await layoutPreloader.preloadDashboardLayout()
    const html = await renderToString(createSSRApp(workspaceModule.default))

    assert.equal(layoutModules.length, 2)
    assert.match(html, /燃动现象智能管理平台工作台/)
    assert.match(html, /数据看板/)
    assert.match(html, /is-layout-preparing/)
    assert.match(html, /aria-busy="true"/)
    assert.match(html, /id="dashboard-focus-layer"/)
    assert.match(html, /aria-label="当前赛季概览"/)
    assert.doesNotMatch(html, /season-workspace-card/)
    // 平台配置不应在默认看板阶段提前挂载，避免发起隐藏页请求。
    assert.doesNotMatch(html, /aria-label="平台配置页面"/)

    const seasonCreateSheetHtml = await renderToString(createSSRApp(
      seasonCreateSheetModule.default,
      { maximumProjectCount: 2 },
    ))
    assert.match(seasonCreateSheetHtml, />1 个</)
    assert.match(seasonCreateSheetHtml, />2 个</)
    assert.doesNotMatch(seasonCreateSheetHtml, />3 个</)
    assert.match(seasonCreateSheetHtml, /aria-pressed="false"/)
    assert.match(
      seasonCreateSheetHtml,
      /class="season-create-sheet__submit"[^>]*aria-pressed="false"/,
    )

    // 放大层使用预选中的独立卡片实例，必须能直接消费共享人员模型。
    const enrollmentHtml = await renderToString(createSSRApp(
      enrollmentFlipCardModule.default,
      {
        title: '各等级报名人数',
        items: [{ name: '青铜', value: 1 }],
        membersByItem: {
          青铜: [{
            id: 'user-1',
            name: '张三',
            department: '研发部',
            projectProgresses: [
              { projectId: 1, projectName: '跑步/快走', progress: 75 },
              { projectId: 2, projectName: '健身打卡', progress: 40 },
            ],
          }],
        },
        selectedName: '青铜',
        detailTitleSuffix: '等级',
        layout: 'wide',
      },
    ))
    assert.match(enrollmentHtml, /enrollment-flip-card--flipped/)
    assert.match(enrollmentHtml, /报名人员 · 1 人/)
    assert.match(enrollmentHtml, />张三</)
    assert.match(enrollmentHtml, /研发部/)
    assert.match(enrollmentHtml, /项目进度/)
    assert.match(enrollmentHtml, /跑步\/快走/)
    assert.match(enrollmentHtml, />75%<\/em>/)
  } finally {
    await viteServer.close()
  }
})
