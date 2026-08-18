<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import surprisedIcon from '../../assets/用户事务/惊讶.webp'

const props = defineProps({
  seasonName: {
    type: String,
    required: true,
  },
  submitMessage: {
    type: String,
    default: '',
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  result: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['cancel', 'confirm', 'clear-message'])
const confirmationInput = ref(null)
const confirmationText = ref('')
const isSurprisedIconLoaded = ref(false)
const expectedConfirmation = computed(() => `我确认结算${props.seasonName}`)
const canConfirm = computed(
  () => !props.submitting
    && !props.result
    && confirmationText.value === expectedConfirmation.value,
)

function submitFinalization() {
  if (!canConfirm.value) return
  emit('confirm')
}

function requestCancel() {
  // 提交期间禁止关闭弹窗，避免管理员误以为事务已经被前端取消。
  if (!props.submitting) emit('cancel')
}

onMounted(async () => {
  await nextTick()
  confirmationInput.value?.focus()
})
</script>

<template>
  <div
    class="settlement-finalize-overlay"
    role="presentation"
    @click.self="requestCancel"
    @keydown.esc.stop.prevent="requestCancel"
  >
    <section
      class="settlement-finalize-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-finalize-title"
      :aria-describedby="result ? 'settlement-finalize-result' : 'settlement-finalize-description'"
    >
      <header class="settlement-finalize-dialog__header">
        <span aria-hidden="true">
          <img
            :src="surprisedIcon"
            alt=""
            :class="{ 'is-loaded': isSurprisedIconLoaded }"
            @load="isSurprisedIconLoaded = true"
          />
        </span>
        <div>
          <small>{{ result ? '结算完成' : '高风险操作' }}</small>
          <h3 id="settlement-finalize-title">
            {{ result ? `${seasonName} 已结束` : `最终结算 ${seasonName}` }}
          </h3>
        </div>
      </header>

      <div
        v-if="!result"
        id="settlement-finalize-description"
        class="settlement-finalize-dialog__warning"
      >
        <strong>确认后将立即执行以下操作：</strong>
        <ul>
          <li>自动拒绝当前赛季所有仍未完成审核的凭证（含待初审与待终审）。</li>
          <li>根据每位用户最终项目进度计算积分，并完成积分发放。</li>
        </ul>
        <p>该操作影响整个赛季，请在确认队列与项目进度无误后继续。</p>
      </div>

      <section
        v-if="result"
        id="settlement-finalize-result"
        class="settlement-finalize-dialog__result"
        aria-live="polite"
      >
        <strong>赛季已完成结算并发放积分</strong>
        <div>
          <span><b>{{ result.participantCount }}</b><small>正式参赛</small></span>
          <span><b>{{ result.rejectedProofCount }}</b><small>自动拒绝凭证</small></span>
          <span><b>{{ result.finalizedUserCount }}</b><small>本次新定分</small></span>
          <span><b>{{ result.issuedUserCount }}</b><small>本次新发放</small></span>
        </div>
        <button type="button" @click="requestCancel">完成</button>
      </section>

      <form
        v-else
        class="settlement-finalize-dialog__form"
        @submit.prevent="submitFinalization"
      >
        <label for="settlement-finalize-confirmation">
          输入以下完整文字以继续
        </label>
        <code>{{ expectedConfirmation }}</code>
        <input
          id="settlement-finalize-confirmation"
          ref="confirmationInput"
          v-model="confirmationText"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="expectedConfirmation"
          :disabled="submitting"
          @input="emit('clear-message')"
        />

        <p
          v-if="submitMessage"
          class="settlement-finalize-dialog__message"
          role="alert"
        >
          {{ submitMessage }}
        </p>

        <footer>
          <button type="button" class="is-cancel" :disabled="submitting" @click="requestCancel">
            取消
          </button>
          <button
            type="submit"
            class="is-finalize"
            :disabled="!canConfirm"
            :aria-busy="submitting"
          >
            <span v-if="submitting" class="settlement-finalize-dialog__spinner" aria-hidden="true"></span>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 2.8 20h18.4L12 3Z" />
              <path d="M12 8.4v5.7M12 17.4h.01" />
            </svg>
            {{ submitting ? '结算中…' : '最终结算' }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.settlement-finalize-overlay {
  position: absolute;
  z-index: 40;
  inset: 0;
  display: grid;
  padding: clamp(18px, 4vw, 42px);
  overflow: auto;
  background: rgb(42 20 24 / 42%);
  place-items: center;
  -webkit-backdrop-filter: blur(12px) saturate(84%);
  backdrop-filter: blur(12px) saturate(84%);
}

.settlement-finalize-dialog {
  width: min(520px, 100%);
  padding: clamp(22px, 3vw, 30px);
  color: #342b2d;
  background:
    radial-gradient(circle at 100% 0%, rgb(222 75 83 / 12%), transparent 36%),
    rgb(255 252 251 / 96%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 96%),
    0 26px 70px rgb(82 24 31 / 28%);
}

.settlement-finalize-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.settlement-finalize-dialog__header > span {
  display: grid;
  width: 62px;
  height: 62px;
  flex: 0 0 auto;
  place-items: center;
}

.settlement-finalize-dialog__form .is-finalize svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.settlement-finalize-dialog__header img {
  width: 68px;
  height: 68px;
  object-fit: contain;
  opacity: 0;
  filter: drop-shadow(0 11px 16px rgb(125 54 35 / 24%));
  transform: translateY(7px) scale(0.84);
  transition:
    opacity 720ms ease,
    transform 820ms cubic-bezier(0.16, 1, 0.3, 1);
}

.settlement-finalize-dialog__header img.is-loaded {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.settlement-finalize-dialog__header small {
  display: block;
  margin-bottom: 4px;
  color: #bd3a47;
  font-size: 10px;
  font-weight: 820;
  letter-spacing: 0.12em;
}

.settlement-finalize-dialog__header h3 {
  margin: 0;
  font-size: clamp(19px, 2vw, 24px);
  font-weight: 820;
  letter-spacing: -0.025em;
}

.settlement-finalize-dialog__warning {
  margin-top: 20px;
  padding: 16px 18px;
  background: rgb(224 67 77 / 7%);
  border: 1px solid rgb(211 59 70 / 14%);
  border-radius: 17px;
}

.settlement-finalize-dialog__warning strong {
  color: #9e2f3c;
  font-size: 13px;
}

.settlement-finalize-dialog__warning ul {
  margin: 11px 0 0;
  padding-left: 20px;
  color: #5e464a;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.65;
}

.settlement-finalize-dialog__warning p {
  margin: 10px 0 0;
  color: #8a6469;
  font-size: 11px;
  line-height: 1.5;
}

.settlement-finalize-dialog__form {
  display: grid;
  margin-top: 18px;
  gap: 9px;
}

.settlement-finalize-dialog__form label {
  color: #65575a;
  font-size: 12px;
  font-weight: 720;
}

.settlement-finalize-dialog__form code {
  width: fit-content;
  max-width: 100%;
  padding: 5px 8px;
  overflow-wrap: anywhere;
  color: #a72e3b;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  background: rgb(219 58 70 / 8%);
  border-radius: 7px;
  user-select: text;
}

.settlement-finalize-dialog__form input {
  width: 100%;
  height: 44px;
  padding: 0 13px;
  color: #392f31;
  font: inherit;
  font-size: 13px;
  background: rgb(255 255 255 / 78%);
  border: 1px solid rgb(116 85 90 / 20%);
  border-radius: 12px;
  outline: none;
  transition: border-color 240ms ease, box-shadow 280ms ease;
}

.settlement-finalize-dialog__form input:focus {
  border-color: rgb(205 52 65 / 54%);
  box-shadow: 0 0 0 4px rgb(211 58 70 / 10%);
}

.settlement-finalize-dialog__message {
  margin: 2px 0 0;
  color: #af3541;
  font-size: 11px;
  font-weight: 680;
}

.settlement-finalize-dialog__result {
  display: grid;
  margin-top: 20px;
  gap: 16px;
  animation: settlement-finalize-result-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.settlement-finalize-dialog__result > strong {
  color: #7a2932;
  font-size: 14px;
}

.settlement-finalize-dialog__result > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.settlement-finalize-dialog__result span {
  display: grid;
  min-height: 78px;
  padding: 13px;
  align-content: center;
  gap: 2px;
  background: rgb(224 67 77 / 7%);
  border: 1px solid rgb(211 59 70 / 12%);
  border-radius: 15px;
}

.settlement-finalize-dialog__result b {
  color: #a72e3b;
  font-size: 22px;
}

.settlement-finalize-dialog__result small {
  color: #786166;
  font-size: 11px;
  font-weight: 680;
}

.settlement-finalize-dialog__result > button {
  min-height: 42px;
  color: #fffafa;
  font: inherit;
  font-size: 12px;
  font-weight: 780;
  background: linear-gradient(135deg, #e04b56, #aa2838);
  border: 0;
  border-radius: 12px;
  box-shadow: 0 9px 20px rgb(181 39 53 / 24%);
  cursor: pointer;
}

.settlement-finalize-dialog__spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgb(255 255 255 / 38%);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: settlement-finalize-spin 700ms linear infinite;
}

@keyframes settlement-finalize-spin {
  to { transform: rotate(1turn); }
}

@keyframes settlement-finalize-result-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

.settlement-finalize-dialog__form footer {
  display: flex;
  margin-top: 10px;
  justify-content: flex-end;
  gap: 10px;
}

.settlement-finalize-dialog__form button {
  display: inline-flex;
  min-height: 40px;
  padding: 0 16px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #66585b;
  font: inherit;
  font-size: 12px;
  font-weight: 780;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(114 87 91 / 17%);
  border-radius: 12px;
  cursor: pointer;
  transition:
    opacity 240ms ease,
    box-shadow 340ms ease,
    transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
}

.settlement-finalize-dialog__form .is-finalize {
  color: #fffafa;
  background: linear-gradient(135deg, #e04b56, #aa2838);
  border-color: rgb(153 28 43 / 28%);
  box-shadow: 0 9px 20px rgb(181 39 53 / 24%);
}

.settlement-finalize-dialog__form .is-finalize svg {
  width: 17px;
  height: 17px;
}

.settlement-finalize-dialog__form button:disabled {
  cursor: not-allowed;
  opacity: 0.36;
  box-shadow: none;
}

@media (hover: hover) {
  .settlement-finalize-dialog__form button:hover:not(:disabled) {
    box-shadow: 0 10px 24px rgb(95 58 64 / 14%);
    transform: translateY(-2px);
  }

  .settlement-finalize-dialog__form .is-finalize:hover:not(:disabled) {
    box-shadow: 0 13px 28px rgb(181 39 53 / 32%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settlement-finalize-dialog__header img {
    transform: none;
    transition: opacity 160ms ease;
  }

  .settlement-finalize-dialog__result {
    animation: none;
  }

  .settlement-finalize-dialog__form input,
  .settlement-finalize-dialog__form button,
  .settlement-finalize-dialog__result > button {
    transition: none;
  }
}
</style>
