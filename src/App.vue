<script setup>
import { onBeforeUnmount, ref } from 'vue'
import AccessKeyLoginCard from './components/auth/AccessKeyLoginCard.vue'
import MainWorkspaceShell from './components/layout/MainWorkspaceShell.vue'
import FlowingGradientBackground from './components/visual/FlowingGradientBackground.vue'
import { usePreventPageZoom } from './composables/usePreventPageZoom.js'

usePreventPageZoom()

const isAuthenticating = ref(false)
const isWorkspaceVisible = ref(false)

// 登录阶段提高色彩流速以呼应赛季卡片，进入工作台后降速，避免背景抢夺数据注意力。
const loginBackgroundSpeed = 1.5
const workspaceBackgroundSpeed = 0.55

let prototypeLoginTimerId = 0

function handleLogin() {
  if (isAuthenticating.value) return

  isAuthenticating.value = true

  // 认证接口尚未接入，暂以可见的校验时长演示“成功后进入主界面”的完整动效。
  prototypeLoginTimerId = window.setTimeout(() => {
    isAuthenticating.value = false
    isWorkspaceVisible.value = true
  }, 2200)
}

function handleExitPreview() {
  isWorkspaceVisible.value = false
}

onBeforeUnmount(() => {
  window.clearTimeout(prototypeLoginTimerId)
})
</script>

<template>
  <main class="welcome-page">
    <FlowingGradientBackground
      :speed="isWorkspaceVisible ? workspaceBackgroundSpeed : loginBackgroundSpeed"
    />

    <Transition name="workspace-zoom">
      <div v-if="!isWorkspaceVisible" key="login" class="welcome-page__stage welcome-page__stage--login">
        <AccessKeyLoginCard :loading="isAuthenticating" @submit="handleLogin" />
      </div>

      <div v-else key="workspace" class="welcome-page__stage welcome-page__stage--workspace">
        <MainWorkspaceShell @exit="handleExitPreview" />
      </div>
    </Transition>
  </main>
</template>
