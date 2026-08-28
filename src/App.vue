<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { loginAdmin, validateAdminSession } from './api/auth/adminAuthApi.js'
import AccessKeyLoginCard from './components/auth/AccessKeyLoginCard.vue'
import MainWorkspaceShell from './components/layout/MainWorkspaceShell.vue'
import MolecularFieldBackground from './components/visual/MolecularFieldBackground.vue'
import { usePreventPageZoom } from './composables/usePreventPageZoom.js'
import {
  clearAdminSession,
  getAdminAccessToken,
  subscribeToAdminSessionInvalidation,
} from './services/adminSession.js'
import {
  preloadDashboardLayout,
} from './services/dashboardLayoutPreloader.js'

usePreventPageZoom()

const isAuthenticating = ref(false)
const isRestoringSession = ref(false)
const isWorkspaceVisible = ref(false)
const loginError = ref('')
const loginNotice = ref('')
const isLoginBusy = computed(() => isAuthenticating.value || isRestoringSession.value)

let unsubscribeFromSessionInvalidation = () => {}

function preloadDashboardInBackground() {
  // 数据看板图表较重，不能阻塞已认证管理员进入其他常驻模块；异步组件会在看板实际展示时继续自行解析。
  void preloadDashboardLayout().catch(() => {})
}

// 使用管理员密钥换取令牌，只有后端确认成功后才进入工作台。
async function handleLogin(adminKey) {
  if (isLoginBusy.value) return

  isAuthenticating.value = true
  loginError.value = ''
  loginNotice.value = ''

  try {
    await loginAdmin(adminKey)
    isWorkspaceVisible.value = true
    preloadDashboardInBackground()
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  } finally {
    isAuthenticating.value = false
  }
}

// 主动退出只清除本标签页令牌，不触发“会话失效”提示。
function handleExitPreview() {
  clearAdminSession()
  isWorkspaceVisible.value = false
  loginError.value = ''
  loginNotice.value = ''
}

// 用户继续输入时移除旧错误，避免无效密钥提示干扰下一次尝试。
function clearLoginFeedback() {
  loginError.value = ''
  loginNotice.value = ''
}

// 任何受保护请求被后端重定向时统一撤出工作台，禁止自动重放原请求。
function handleSessionInvalidation(reason) {
  isWorkspaceVisible.value = false
  isAuthenticating.value = false
  loginError.value = ''
  loginNotice.value =
    reason === 'expired' ? '登录状态已过期，请重新输入管理密钥' : '登录状态已失效，请重新验证'
}

// 页面刷新后使用会话接口验证缓存令牌，验证失败前不展示受保护工作台。
async function restoreAdminSession() {
  if (!getAdminAccessToken()) return

  isRestoringSession.value = true
  loginNotice.value = '正在确认登录状态…'

  try {
    const isAuthenticated = await validateAdminSession()
    if (isAuthenticated) {
      loginNotice.value = ''
      isWorkspaceVisible.value = true
      preloadDashboardInBackground()
      return
    }

    clearAdminSession()
    loginNotice.value = '登录状态已失效，请重新验证'
  } catch (error) {
    if (error?.name !== 'AdminAuthenticationRequiredError') {
      loginError.value = '暂时无法验证登录状态，请重新登录'
      loginNotice.value = ''
    }
  } finally {
    isRestoringSession.value = false
  }
}

onMounted(() => {
  unsubscribeFromSessionInvalidation = subscribeToAdminSessionInvalidation(
    handleSessionInvalidation,
  )
  restoreAdminSession()
})

onBeforeUnmount(() => {
  unsubscribeFromSessionInvalidation()
})
</script>

<template>
  <main class="welcome-page">
    <MolecularFieldBackground />

    <Transition name="workspace-zoom">
      <div v-if="!isWorkspaceVisible" key="login" class="welcome-page__stage welcome-page__stage--login">
        <AccessKeyLoginCard
          :loading="isLoginBusy"
          :error="loginError"
          :notice="loginNotice"
          @input="clearLoginFeedback"
          @submit="handleLogin"
        />
      </div>

      <div v-else key="workspace" class="welcome-page__stage welcome-page__stage--workspace">
        <MainWorkspaceShell @exit="handleExitPreview" />
      </div>
    </Transition>
  </main>
</template>
