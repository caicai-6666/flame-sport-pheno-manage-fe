<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import RewardCreateSheet from './RewardCreateSheet.vue'

const rewardPalettes = [
  ['#e59462', '#f8d9b5', '#8d4f31'],
  ['#54a58e', '#bce4d5', '#2f685a'],
  ['#6387c9', '#c8d8f1', '#38527f'],
  ['#9b6bc0', '#dfcaed', '#5c3d78'],
  ['#d26f7f', '#f2c5cd', '#7b3e49'],
]

// 原型数据使用 product 表的字段命名，接入接口后只需替换数据来源和提交动作。
const rewards = ref([
  {
    id: 1,
    name: '轻量跳绳',
    description: '顺滑轴承与亲肤握把，适合日常有氧训练。',
    points_required: 80,
    image_url: '',
    status: 1,
    artworkHeight: 142,
    palette: rewardPalettes[0],
    artworkPaths: [
      'M31 14c-8 1-12 8-12 17 0 11 6 19 16 19s16-8 16-19c0-9-4-16-12-17',
      'M27 9h8v12h-8zM35 9h8v12h-8z',
    ],
  },
  {
    id: 2,
    name: '速干运动毛巾',
    description: '柔软吸汗，轻巧便携，适合训练后快速擦拭。',
    points_required: 120,
    image_url: '',
    status: 1,
    artworkHeight: 176,
    palette: rewardPalettes[1],
    artworkPaths: [
      'M18 13h36v34H18z',
      'M18 22h36M29 13v34M42 13v34M23 39h26',
    ],
  },
  {
    id: 3,
    name: '随行运动水杯',
    description: '大容量防漏杯身，通勤与户外运动均可使用。',
    points_required: 180,
    image_url: '',
    status: 1,
    artworkHeight: 224,
    palette: rewardPalettes[2],
    artworkPaths: [
      'M25 16h22l-2 38H27z',
      'M29 9h14v7H29zM31 25h10M30 34h12',
    ],
  },
  {
    id: 4,
    name: '防滑瑜伽垫',
    description: '加厚缓冲与细腻防滑纹理，兼顾拉伸和力量训练。',
    points_required: 320,
    image_url: '',
    status: 1,
    artworkHeight: 136,
    palette: rewardPalettes[3],
    artworkPaths: [
      'M13 37h41c5 0 8 3 8 8s-3 8-8 8H13z',
      'M54 37c-5 0-8 3-8 8s3 8 8 8 8-3 8-8-3-8-8-8zM13 37l8-17h34',
    ],
  },
  {
    id: 5,
    name: '城市运动背包',
    description: '独立鞋仓与透气背板，满足训练和短途出行收纳。',
    points_required: 520,
    image_url: '',
    status: 1,
    artworkHeight: 204,
    palette: rewardPalettes[4],
    artworkPaths: [
      'M21 25h30l5 31H16z',
      'M27 25v-4c0-7 4-11 9-11s9 4 9 11v4M24 36h24M28 44h16',
    ],
  },
])

const editingRewardId = ref(null)
const masonryRef = ref(null)
const masonryWidth = ref(0)
const isCreateSheetOpen = ref(false)
const deleteConfirmationVisible = ref(false)
const validationMessage = ref('')
const imageValidationMessage = ref('')
const draft = ref(createEmptyDraft())

let sortTimerId = 0
let removeTimerId = 0
let masonryObserver

const MASONRY_GAP = 15
const CARD_CONTENT_HEIGHT = 154
const CREATE_CARD_ID = 'create-reward'
const CREATE_CARD_HEIGHT = 196
// 该高度可以完整容纳背面表单；正面图片较高时，卡片可在此基础上继续增高。
const CARD_EDITOR_MIN_HEIGHT = 356

let nextLocalRewardId = Math.max(...rewards.value.map((reward) => reward.id)) + 1

const masonryLayout = computed(() => {
  const availableWidth = masonryWidth.value || 900
  const columnCount = availableWidth >= 820 ? 3 : availableWidth >= 520 ? 2 : 1
  const columnWidth = (availableWidth - MASONRY_GAP * (columnCount - 1)) / columnCount
  const columnHeights = Array.from({ length: columnCount }, () => 0)
  const positions = {}

  const layoutItems = [
    { id: CREATE_CARD_ID, height: CREATE_CARD_HEIGHT },
    ...rewards.value.map((reward) => ({
      id: reward.id,
      height: Math.max(
        CARD_EDITOR_MIN_HEIGHT,
        reward.artworkHeight + CARD_CONTENT_HEIGHT,
      ),
    })),
  ]

  layoutItems.forEach((item) => {
    const shortestHeight = Math.min(...columnHeights)
    const columnIndex = columnHeights.indexOf(shortestHeight)

    positions[item.id] = {
      width: `${columnWidth}px`,
      height: `${item.height}px`,
      transform: `translate3d(${columnIndex * (columnWidth + MASONRY_GAP)}px, ${shortestHeight}px, 0)`,
    }
    columnHeights[columnIndex] += item.height + MASONRY_GAP
  })

  return {
    height: Math.max(0, ...columnHeights) - MASONRY_GAP,
    positions,
  }
})

function createEmptyDraft() {
  return {
    name: '',
    description: '',
    points_required: '',
    image_url: '',
    imageFileName: '',
    artworkHeight: 176,
  }
}

async function openRewardEditor(reward) {
  window.clearTimeout(sortTimerId)
  window.clearTimeout(removeTimerId)
  editingRewardId.value = reward.id
  deleteConfirmationVisible.value = false
  validationMessage.value = ''
  imageValidationMessage.value = ''
  draft.value = {
    name: reward.name,
    description: reward.description ?? '',
    points_required: String(reward.points_required),
    image_url: reward.image_url ?? '',
    imageFileName: '',
    artworkHeight: reward.artworkHeight,
  }

  await nextTick()
  document.querySelector(`[data-reward-id="${reward.id}"] input[name="reward-name"]`)?.focus()
}

function closeRewardEditor() {
  editingRewardId.value = null
  deleteConfirmationVisible.value = false
  validationMessage.value = ''
  imageValidationMessage.value = ''
  draft.value = createEmptyDraft()
}

function openCreateSheet() {
  closeRewardEditor()
  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  isCreateSheetOpen.value = false
}

function createReward(payload) {
  const localId = nextLocalRewardId++
  const reward = {
    id: localId,
    name: payload.name,
    description: payload.description,
    points_required: payload.pointsRequired,
    image_url: payload.imageDataUrl,
    status: 1,
    artworkHeight: payload.artworkHeight,
    palette: rewardPalettes[(localId - 1) % rewardPalettes.length],
    artworkPaths: [
      'M17 28h38v27H17zM36 28v27M14 28h44v-9H14z',
      'M36 19H25c-6 0-7-9-1-10 5-1 9 4 12 10zm0 0h11c6 0 7-9 1-10-5-1-9 4-12 10z',
    ],
  }

  // 新商品创建后立即回到积分升序，瀑布流会平滑计算其落点。
  rewards.value = [...rewards.value, reward].sort(
    (left, right) => left.points_required - right.points_required || left.id - right.id,
  )
  closeCreateSheet()
}

function clearValidation() {
  validationMessage.value = ''
}

function handleImageSelection(event) {
  const [file] = event.target.files ?? []
  imageValidationMessage.value = ''

  if (!file) return

  const supportedTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!supportedTypes.includes(file.type)) {
    imageValidationMessage.value = '请选择 PNG、JPG 或 WebP 图片'
    event.target.value = ''
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    imageValidationMessage.value = '图片大小不能超过 5 MB'
    event.target.value = ''
    return
  }

  const reader = new FileReader()
  reader.addEventListener('load', () => {
    // Data URL 仅用于原型预览；真实提交时应改为上传文件后保存服务端图片地址。
    const dataUrl = String(reader.result ?? '')
    draft.value.image_url = dataUrl
    draft.value.imageFileName = file.name

    const image = new Image()
    image.addEventListener('load', () => {
      const aspectRatio = image.naturalWidth / image.naturalHeight

      // 横图、方图和竖图使用不同展示高度，形成稳定而不过度参差的瀑布流节奏。
      if (aspectRatio >= 1.5) draft.value.artworkHeight = 136
      else if (aspectRatio >= 1.12) draft.value.artworkHeight = 156
      else if (aspectRatio >= 0.86) draft.value.artworkHeight = 180
      else if (aspectRatio >= 0.65) draft.value.artworkHeight = 206
      else draft.value.artworkHeight = 230
    })
    image.src = dataUrl
  })
  reader.addEventListener('error', () => {
    imageValidationMessage.value = '图片读取失败，请重新选择'
  })
  reader.readAsDataURL(file)
}

function validateDraft() {
  const normalizedName = draft.value.name.trim()
  const normalizedDescription = draft.value.description.trim()
  const normalizedPoints = Number(draft.value.points_required)

  if (!normalizedName) return '奖品名称不能为空'
  if (normalizedName.length > 128) return '奖品名称不能超过 128 个字符'
  if (normalizedDescription.length > 255) return '奖品描述不能超过 255 个字符'
  if (
    draft.value.points_required === '' ||
    !Number.isSafeInteger(normalizedPoints) ||
    normalizedPoints < 0 ||
    normalizedPoints > 4294967295
  ) {
    return '兑换积分必须是非负整数'
  }

  return ''
}

function sortRewards() {
  // 积分相同时使用 ID 保持稳定顺序，避免相同价格的卡片反复换位。
  rewards.value = [...rewards.value].sort(
    (left, right) => left.points_required - right.points_required || left.id - right.id,
  )
}

function saveReward(reward) {
  const message = validateDraft()
  if (message) {
    validationMessage.value = message
    return
  }

  reward.name = draft.value.name.trim()
  reward.description = draft.value.description.trim()
  reward.points_required = Number(draft.value.points_required)
  reward.image_url = draft.value.image_url
  reward.artworkHeight = draft.value.artworkHeight
  closeRewardEditor()

  // 等待卡片翻回正面后再重排，价格变化时不会出现翻转过程中突然换位。
  sortTimerId = window.setTimeout(sortRewards, 720)
}

function toggleRewardVisibility(reward) {
  // 隐藏对应 product.status = 0，管理端仍保留该卡片以便恢复展示。
  reward.status = reward.status === 0 ? 1 : 0
}

function requestRewardDeletion() {
  deleteConfirmationVisible.value = true
}

function cancelRewardDeletion() {
  deleteConfirmationVisible.value = false
}

function confirmRewardDeletion(reward) {
  // 真实删除前必须由后端校验兑换历史引用，本轮只移除本地原型数据。
  const rewardId = reward.id
  deleteConfirmationVisible.value = false
  closeRewardEditor()
  removeTimerId = window.setTimeout(() => {
    rewards.value = rewards.value.filter((item) => item.id !== rewardId)
  }, 720)
}

function handleEditorEscape() {
  if (deleteConfirmationVisible.value) {
    cancelRewardDeletion()
    return
  }

  closeRewardEditor()
}

onBeforeUnmount(() => {
  window.clearTimeout(sortTimerId)
  window.clearTimeout(removeTimerId)
  masonryObserver?.disconnect()
})

onMounted(() => {
  masonryObserver = new ResizeObserver(([entry]) => {
    masonryWidth.value = entry.contentRect.width
  })
  if (masonryRef.value) masonryObserver.observe(masonryRef.value)
})
</script>

<template>
  <section class="reward-configuration" aria-label="全部奖品">
    <div class="reward-configuration__scroll" :inert="isCreateSheetOpen">
      <header class="reward-configuration__header">
        <div>
          <h2>全部奖品</h2>
          <p>按兑换积分从低到高排列</p>
        </div>
        <span>{{ rewards.length }} 件奖品</span>
      </header>

      <div ref="masonryRef" class="reward-configuration__masonry">
        <TransitionGroup
          name="reward-list"
          tag="div"
          class="reward-configuration__grid"
          :style="{ height: `${masonryLayout.height}px` }"
        >
          <div
            :key="CREATE_CARD_ID"
            class="reward-create-card-slot"
            :style="masonryLayout.positions[CREATE_CARD_ID]"
          >
            <button
              type="button"
              class="reward-create-card"
              aria-label="新增商品"
              @click="openCreateSheet"
            >
              <span class="reward-create-card__plus" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span>
                <strong>新增商品</strong>
                <small>创建一件积分商城奖品</small>
              </span>
            </button>
          </div>

          <div
            v-for="(reward, index) in rewards"
            :key="reward.id"
            class="reward-card-slot"
            :class="{ 'is-editing': editingRewardId === reward.id }"
            :style="masonryLayout.positions[reward.id]"
        >
        <article
          class="reward-card"
          :class="{
            'is-flipped': editingRewardId === reward.id,
            'is-hidden': reward.status === 0,
          }"
          :data-reward-id="reward.id"
          :style="{
            '--reward-primary': reward.palette[0],
            '--reward-secondary': reward.palette[1],
            '--reward-ink': reward.palette[2],
            '--reward-artwork-height': `${reward.artworkHeight}px`,
            '--reward-enter-delay': `${index * 75}ms`,
          }"
        >
          <div class="reward-card__inner">
            <button
              type="button"
              class="reward-card__side reward-card__front"
              :aria-label="`修改${reward.name}`"
              :aria-expanded="editingRewardId === reward.id"
              :aria-hidden="editingRewardId === reward.id"
              :inert="editingRewardId === reward.id"
              @click="openRewardEditor(reward)"
            >
              <span class="reward-card__artwork">
                <img v-if="reward.image_url" :src="reward.image_url" alt="" />
                <svg v-else viewBox="0 0 72 64" aria-hidden="true">
                  <path v-for="path in reward.artworkPaths" :key="path" :d="path" />
                </svg>
                <small v-if="reward.status === 0">已隐藏</small>
              </span>

              <span class="reward-card__content">
                <span class="reward-card__name-row">
                  <strong>{{ reward.name }}</strong>
                  <i aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
                  </i>
                </span>
                <span class="reward-card__description">{{ reward.description || '暂未填写奖品描述' }}</span>
                <span class="reward-card__points">
                  <small>兑换积分</small>
                  <strong>{{ reward.points_required.toLocaleString('zh-CN') }}<i>分</i></strong>
                </span>
              </span>
            </button>

            <form
              class="reward-card__side reward-card__back"
              :aria-label="`编辑${reward.name}`"
              :aria-hidden="editingRewardId !== reward.id"
              :inert="editingRewardId !== reward.id"
              @submit.prevent="saveReward(reward)"
              @keydown.esc.prevent="handleEditorEscape"
            >
              <header class="reward-card__editor-header">
                <button type="button" aria-label="返回奖品正面" @click="closeRewardEditor">
                  <svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></svg>
                </button>
                <div>
                  <small>奖品资料</small>
                  <h3>编辑奖品</h3>
                </div>
                <div class="reward-card__management-actions">
                  <button
                    type="button"
                    :class="{ 'is-restore': reward.status === 0 }"
                    :aria-label="reward.status === 0 ? '恢复展示' : '隐藏奖品'"
                    :title="reward.status === 0 ? '恢复展示' : '隐藏奖品'"
                    @click="toggleRewardVisibility(reward)"
                  >
                    <svg v-if="reward.status === 0" viewBox="0 0 24 24">
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9a3 3 0 1 1 0 6" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24">
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM4 4l16 16" />
                    </svg>
                    <span>{{ reward.status === 0 ? '恢复' : '隐藏' }}</span>
                  </button>
                  <button
                    type="button"
                    class="is-danger"
                    aria-label="删除奖品"
                    title="删除奖品"
                    @click="requestRewardDeletion"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
                    </svg>
                    <span>删除</span>
                  </button>
                </div>
              </header>

              <div class="reward-card__editor-body">
                <label class="reward-card__image-editor">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    @change="handleImageSelection"
                  />
                  <span class="reward-card__image-preview">
                    <img v-if="draft.image_url" :src="draft.image_url" alt="奖品图片预览" />
                    <svg v-else viewBox="0 0 72 64" aria-hidden="true">
                      <path v-for="path in reward.artworkPaths" :key="path" :d="path" />
                    </svg>
                  </span>
                  <span class="reward-card__image-copy">
                    <strong>{{ draft.imageFileName || '更换奖品图片' }}</strong>
                    <small>{{ imageValidationMessage || 'PNG / JPG / WebP，最大 5 MB' }}</small>
                  </span>
                  <span class="reward-card__image-add" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                </label>

                <div class="reward-card__field-row">
                  <label class="reward-card__field">
                    <span>奖品名称</span>
                    <input
                      v-model="draft.name"
                      name="reward-name"
                      maxlength="128"
                      autocomplete="off"
                      @input="clearValidation"
                    />
                  </label>
                  <label class="reward-card__field reward-card__field--points">
                    <span>兑换积分</span>
                    <span class="reward-card__points-input">
                      <input
                        v-model="draft.points_required"
                        type="number"
                        min="0"
                        max="4294967295"
                        step="1"
                        inputmode="numeric"
                        @input="clearValidation"
                      />
                      <small>分</small>
                    </span>
                  </label>
                </div>

                <label class="reward-card__field reward-card__field--description">
                  <span>奖品描述</span>
                  <textarea
                    v-model="draft.description"
                    maxlength="255"
                    rows="2"
                    @input="clearValidation"
                  ></textarea>
                </label>

                <p class="reward-card__validation" :class="{ 'is-visible': validationMessage }" role="alert">
                  {{ validationMessage || '请确认奖品资料' }}
                </p>
              </div>

              <footer class="reward-card__editor-footer">
                <button type="button" @click="closeRewardEditor">取消</button>
                <button type="submit">保存修改</button>
              </footer>

              <Transition name="reward-delete-confirm">
                <section
                  v-if="deleteConfirmationVisible"
                  class="reward-card__delete-confirm"
                  role="alertdialog"
                  aria-modal="true"
                  :aria-label="`确认删除${reward.name}`"
                >
                  <span aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 3 2.5 20h19L12 3zM12 9v5m0 3h.01" />
                    </svg>
                  </span>
                  <h4>删除“{{ reward.name }}”？</h4>
                  <p>原型中会直接移除这张卡片，刷新页面后恢复。</p>
                  <div>
                    <button type="button" @click="cancelRewardDeletion">暂不删除</button>
                    <button type="button" @click="confirmRewardDeletion(reward)">确认删除</button>
                  </div>
                </section>
              </Transition>
            </form>
          </div>
        </article>
          </div>
        </TransitionGroup>
      </div>

      <p v-if="rewards.length === 0" class="reward-configuration__empty">暂无奖品</p>
    </div>

    <Transition name="reward-create-sheet">
      <RewardCreateSheet
        v-if="isCreateSheetOpen"
        @cancel="closeCreateSheet"
        @submit="createReward"
      />
    </Transition>
  </section>
</template>

<style scoped>
.reward-configuration {
  position: relative;
  height: 100%;
  overflow: hidden;
  color: #303b35;
  user-select: none;
}

.reward-configuration__scroll {
  height: 100%;
  padding: clamp(22px, 2.2vw, 34px);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: rgb(220 130 79 / 28%) transparent;
  scrollbar-width: thin;
}

.reward-configuration__header {
  display: flex;
  margin-bottom: 22px;
  align-items: flex-end;
  justify-content: space-between;
}

.reward-configuration__header h2,
.reward-configuration__header p {
  margin: 0;
}

.reward-configuration__header h2 {
  font-size: clamp(22px, 2vw, 28px);
  letter-spacing: -0.04em;
}

.reward-configuration__header p {
  margin-top: 5px;
  color: #849088;
  font-size: 12px;
  font-weight: 620;
}

.reward-configuration__header > span {
  padding: 7px 12px;
  color: #8b6653;
  font-size: 12px;
  font-weight: 720;
  background: rgb(220 130 79 / 10%);
  border: 1px solid rgb(220 130 79 / 13%);
  border-radius: 999px;
}

.reward-configuration__grid {
  position: relative;
  width: 100%;
  min-height: 260px;
  perspective: 1400px;
  transition: height 680ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card-slot {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 0;
  transition:
    height 680ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 420ms ease,
    transform 680ms cubic-bezier(0.16, 1, 0.3, 1),
    width 520ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: height, transform;
}

.reward-create-card-slot {
  position: absolute;
  top: 0;
  left: 0;
  transition:
    height 680ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 420ms ease,
    transform 680ms cubic-bezier(0.16, 1, 0.3, 1),
    width 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-card {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 20px;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #986044;
  font: inherit;
  text-align: left;
  appearance: none;
  background:
    radial-gradient(circle at 82% 14%, rgb(255 255 255 / 75%), transparent 33%),
    linear-gradient(135deg, rgb(249 225 207 / 72%), rgb(255 249 241 / 78%));
  border: 1px dashed rgb(211 126 78 / 32%);
  border-radius: 23px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 13px 28px rgb(105 69 48 / 7%);
  cursor: pointer;
  transition:
    border-color 320ms ease,
    box-shadow 440ms ease,
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-card__plus {
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  background: rgb(255 255 255 / 67%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 17px;
  box-shadow: 0 10px 22px rgb(136 78 47 / 10%);
  place-items: center;
  transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-card__plus svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.reward-create-card > span:last-child {
  min-width: 0;
}

.reward-create-card strong,
.reward-create-card small {
  display: block;
}

.reward-create-card strong {
  color: #654637;
  font-size: 16px;
  letter-spacing: -0.02em;
}

.reward-create-card small {
  margin-top: 5px;
  color: #9b7f70;
  font-size: 10px;
  font-weight: 620;
}

.reward-create-card:hover {
  border-color: rgb(205 112 61 / 48%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 90%),
    0 20px 36px rgb(125 74 45 / 13%);
  transform: translateY(-5px) scale(1.012);
}

.reward-create-card:hover .reward-create-card__plus {
  transform: rotate(90deg) scale(1.06);
}

.reward-create-card:focus-visible {
  outline: 3px solid rgb(220 130 79 / 24%);
  outline-offset: 3px;
}

.reward-card-slot.is-editing {
  z-index: 20;
}

.reward-card {
  position: relative;
  width: 100%;
  min-width: 0;
  height: 100%;
  border-radius: 25px;
  perspective: 1400px;
  transition:
    filter 420ms ease,
    opacity 420ms ease,
    transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
  animation: reward-card-enter 720ms cubic-bezier(0.16, 1, 0.3, 1)
    var(--reward-enter-delay) backwards;
}

@keyframes reward-card-enter {
  from {
    opacity: 0;
    transform: translate3d(0, 22px, 0) scale(0.97);
  }
}

.reward-card:hover:not(.is-flipped) {
  transform: translate3d(0, -7px, 0) scale(1.012);
}

.reward-card.is-hidden:not(.is-flipped) {
  filter: saturate(0.35);
  opacity: 0.68;
}

.reward-card.is-hidden:hover:not(.is-flipped) {
  opacity: 0.86;
}

.reward-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 680ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card.is-flipped .reward-card__inner {
  transform: rotateY(180deg);
}

.reward-card__side {
  position: absolute;
  inset: 0;
  display: flex;
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  color: inherit;
  font: inherit;
  text-align: left;
  appearance: none;
  background: rgb(251 252 250 / 88%);
  border: 1px solid rgb(255 255 255 / 92%);
  border-radius: 25px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 92%),
    0 16px 34px rgb(49 63 54 / 9%);
  backface-visibility: hidden;
}

.reward-card__front {
  padding: 0;
  flex-direction: column;
  cursor: pointer;
  transition: box-shadow 520ms ease;
}

.reward-card:hover .reward-card__front {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 95%),
    0 23px 45px color-mix(in srgb, var(--reward-primary) 18%, transparent);
}

.reward-card__artwork {
  position: relative;
  display: grid;
  height: var(--reward-artwork-height);
  flex: 0 0 var(--reward-artwork-height);
  overflow: hidden;
  background:
    radial-gradient(circle at 73% 21%, rgb(255 255 255 / 65%) 0 7%, transparent 26%),
    radial-gradient(circle at 18% 88%, color-mix(in srgb, var(--reward-primary) 52%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--reward-secondary) 70%, white), rgb(250 246 239 / 92%));
  place-items: center;
}

.reward-card__artwork::before,
.reward-card__artwork::after {
  position: absolute;
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 50%;
  content: '';
}

.reward-card__artwork::before {
  width: 180px;
  height: 180px;
  transform: translate(34%, -48%);
}

.reward-card__artwork::after {
  width: 110px;
  height: 110px;
  transform: translate(-120%, 65%);
}

.reward-card__artwork > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reward-card__artwork > svg {
  z-index: 1;
  width: 108px;
  height: 96px;
  fill: rgb(255 255 255 / 20%);
  stroke: var(--reward-ink);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.6;
  filter: drop-shadow(0 13px 14px color-mix(in srgb, var(--reward-ink) 20%, transparent));
}

.reward-card__artwork > small {
  position: absolute;
  z-index: 2;
  top: 14px;
  right: 14px;
  padding: 6px 10px;
  color: #5e625f;
  font-size: 11px;
  font-style: normal;
  font-weight: 760;
  background: rgb(255 255 255 / 76%);
  border: 1px solid rgb(255 255 255 / 88%);
  border-radius: 999px;
  backdrop-filter: blur(10px);
}

.reward-card__content {
  display: flex;
  min-height: 0;
  padding: 15px 17px 14px;
  flex: 1;
  flex-direction: column;
}

.reward-card__name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}

.reward-card__name-row > strong {
  overflow: hidden;
  font-size: 17px;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reward-card__name-row > i {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  color: var(--reward-primary);
  background: color-mix(in srgb, var(--reward-primary) 10%, transparent);
  border-radius: 50%;
  place-items: center;
  transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card:hover .reward-card__name-row > i {
  transform: translateX(3px);
}

.reward-card__name-row svg {
  width: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.reward-card__description {
  display: -webkit-box;
  margin-top: 5px;
  overflow: hidden;
  color: #7c8880;
  font-size: 12px;
  font-weight: 560;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.reward-card__points {
  display: flex;
  margin-top: auto;
  align-items: flex-end;
  justify-content: space-between;
}

.reward-card__points > small {
  color: #9b938d;
  font-size: 11px;
  font-weight: 700;
}

.reward-card__points > strong {
  color: var(--reward-ink);
  font-size: 22px;
  letter-spacing: -0.04em;
  line-height: 1;
}

.reward-card__points > strong i {
  margin-left: 4px;
  font-size: 11px;
  font-style: normal;
  font-weight: 720;
  letter-spacing: 0;
}

.reward-card__back {
  z-index: 2;
  padding: 17px 18px 16px;
  flex-direction: column;
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--reward-primary) 13%, transparent), transparent 34%),
    rgb(250 252 249 / 96%);
  transform: rotateY(180deg);
}

.reward-card__editor-header {
  display: grid;
  align-items: center;
  gap: 10px;
  grid-template-columns: 34px minmax(0, 1fr) auto;
}

.reward-card__editor-header > button,
.reward-card__management-actions button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #647068;
  appearance: none;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(84 101 91 / 10%);
  border-radius: 11px;
  cursor: pointer;
  place-items: center;
  transition:
    background-color 280ms ease,
    box-shadow 340ms ease,
    color 280ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card__editor-header > button:hover,
.reward-card__management-actions button:hover {
  color: var(--reward-ink);
  background: white;
  box-shadow: 0 8px 16px rgb(50 66 56 / 10%);
  transform: translateY(-2px);
}

.reward-card__editor-header svg,
.reward-card__management-actions svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.reward-card__editor-header small,
.reward-card__editor-header h3 {
  display: block;
  margin: 0;
}

.reward-card__editor-header small {
  color: var(--reward-primary);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.12em;
}

.reward-card__editor-header h3 {
  margin-top: 2px;
  font-size: 16px;
}

.reward-card__management-actions {
  display: flex;
  gap: 6px;
}

.reward-card__management-actions button.is-restore {
  color: #37816d;
  background: rgb(70 168 138 / 10%);
}

.reward-card__management-actions button.is-danger {
  color: #b35d60;
  background: rgb(205 91 96 / 8%);
}

.reward-card__management-actions button {
  width: auto;
  padding: 0 8px;
  gap: 4px;
  font-size: 9px;
  font-weight: 740;
  grid-auto-flow: column;
}

.reward-card__management-actions button svg {
  width: 15px;
  height: 15px;
}

.reward-card__editor-body {
  display: flex;
  min-height: 0;
  margin-top: 13px;
  flex: 0 0 auto;
  flex-direction: column;
}

.reward-card__image-editor {
  display: grid;
  min-height: 66px;
  padding: 8px;
  align-items: center;
  gap: 10px;
  background: rgb(255 255 255 / 66%);
  border: 1px dashed color-mix(in srgb, var(--reward-primary) 28%, transparent);
  border-radius: 16px;
  cursor: pointer;
  grid-template-columns: 54px minmax(0, 1fr) 28px;
  transition:
    background-color 280ms ease,
    border-color 280ms ease,
    transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card__image-editor:hover {
  background: white;
  border-color: color-mix(in srgb, var(--reward-primary) 48%, transparent);
  transform: translateY(-1px);
}

.reward-card__image-editor > input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.reward-card__image-preview {
  display: grid;
  width: 54px;
  height: 48px;
  overflow: hidden;
  color: var(--reward-ink);
  background: color-mix(in srgb, var(--reward-secondary) 52%, white);
  border-radius: 12px;
  place-items: center;
}

.reward-card__image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reward-card__image-preview svg {
  width: 36px;
  height: 32px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.reward-card__image-copy {
  min-width: 0;
}

.reward-card__image-copy strong,
.reward-card__image-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reward-card__image-copy strong {
  font-size: 12px;
}

.reward-card__image-copy small {
  margin-top: 4px;
  color: #8b948e;
  font-size: 9px;
  font-weight: 620;
}

.reward-card__image-add {
  display: grid;
  width: 28px;
  height: 28px;
  color: var(--reward-primary);
  background: color-mix(in srgb, var(--reward-primary) 10%, white);
  border-radius: 9px;
  place-items: center;
}

.reward-card__image-add svg {
  width: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.reward-card__field-row {
  display: grid;
  margin-top: 11px;
  gap: 10px;
  grid-template-columns: minmax(0, 1.35fr) minmax(102px, 0.65fr);
}

.reward-card__field {
  display: block;
  min-width: 0;
}

.reward-card__field > span:first-child {
  display: block;
  margin: 0 0 5px 3px;
  color: #7b867f;
  font-size: 9px;
  font-weight: 760;
}

.reward-card__field input,
.reward-card__field textarea {
  width: 100%;
  color: #334139;
  font: inherit;
  font-size: 12px;
  font-weight: 620;
  outline: none;
  background: rgb(255 255 255 / 76%);
  border: 1px solid rgb(72 92 80 / 10%);
  border-radius: 11px;
  user-select: text;
  transition:
    background-color 260ms ease,
    border-color 260ms ease,
    box-shadow 320ms ease;
}

.reward-card__field input {
  height: 37px;
  padding: 0 10px;
}

.reward-card__field textarea {
  height: 52px;
  padding: 9px 10px;
  line-height: 1.45;
  resize: none;
}

.reward-card__field input:focus,
.reward-card__field textarea:focus {
  background: white;
  border-color: color-mix(in srgb, var(--reward-primary) 45%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--reward-primary) 10%, transparent);
}

.reward-card__points-input {
  position: relative;
  display: block;
}

.reward-card__points-input input {
  padding-right: 28px;
}

.reward-card__points-input small {
  position: absolute;
  top: 50%;
  right: 10px;
  color: #8b948e;
  font-size: 9px;
  font-weight: 700;
  pointer-events: none;
  transform: translateY(-50%);
}

.reward-card__field--description {
  margin-top: 9px;
}

.reward-card__validation {
  height: 14px;
  margin: 4px 2px 0;
  color: #bc5e62;
  font-size: 9px;
  font-weight: 660;
  opacity: 0;
  transition: opacity 220ms ease;
}

.reward-card__validation.is-visible {
  opacity: 1;
}

.reward-card__editor-footer {
  display: grid;
  margin-top: 4px;
  gap: 9px;
  grid-template-columns: 0.72fr 1.28fr;
}

.reward-card__editor-footer button,
.reward-card__delete-confirm button {
  height: 38px;
  color: #627068;
  font: inherit;
  font-size: 11px;
  font-weight: 750;
  appearance: none;
  background: rgb(255 255 255 / 72%);
  border: 1px solid rgb(66 87 75 / 10%);
  border-radius: 12px;
  cursor: pointer;
  transition:
    box-shadow 320ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card__editor-footer button:last-child {
  color: white;
  background: linear-gradient(120deg, var(--reward-primary), var(--reward-ink));
  border-color: transparent;
  box-shadow: 0 10px 20px color-mix(in srgb, var(--reward-primary) 22%, transparent);
}

.reward-card__editor-footer button:hover,
.reward-card__delete-confirm button:hover {
  box-shadow: 0 10px 20px rgb(48 65 54 / 12%);
  transform: translateY(-2px);
}

.reward-card__delete-confirm {
  position: absolute;
  z-index: 8;
  inset: 0;
  display: flex;
  padding: 30px;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: rgb(249 250 248 / 92%);
  backdrop-filter: blur(16px);
  flex-direction: column;
}

.reward-card__delete-confirm > span {
  display: grid;
  width: 54px;
  height: 54px;
  color: #b75e62;
  background: rgb(203 83 90 / 10%);
  border-radius: 18px;
  place-items: center;
}

.reward-card__delete-confirm svg {
  width: 26px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.reward-card__delete-confirm h4 {
  margin: 17px 0 0;
  font-size: 18px;
}

.reward-card__delete-confirm p {
  margin: 8px 0 20px;
  color: #808b84;
  font-size: 11px;
  font-weight: 560;
}

.reward-card__delete-confirm div {
  display: grid;
  width: min(270px, 100%);
  gap: 9px;
  grid-template-columns: 1fr 1fr;
}

.reward-card__delete-confirm button:last-child {
  color: white;
  background: #b85f63;
  border-color: transparent;
}

.reward-delete-confirm-enter-active,
.reward-delete-confirm-leave-active {
  transition:
    opacity 320ms ease,
    backdrop-filter 320ms ease;
}

.reward-delete-confirm-enter-from,
.reward-delete-confirm-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}

.reward-create-sheet-enter-active,
.reward-create-sheet-leave-active {
  transition: opacity 420ms ease;
}

.reward-create-sheet-enter-active :deep(.reward-create-sheet),
.reward-create-sheet-leave-active :deep(.reward-create-sheet) {
  transition: transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-create-sheet-enter-from,
.reward-create-sheet-leave-to {
  opacity: 0;
}

.reward-create-sheet-enter-from :deep(.reward-create-sheet),
.reward-create-sheet-leave-to :deep(.reward-create-sheet) {
  transform: translateY(100%);
}

.reward-list-move {
  transition: transform 680ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-list-leave-active {
  opacity: 0;
  transition: opacity 360ms ease;
}

.reward-configuration__empty {
  display: grid;
  min-height: 260px;
  margin: 0;
  color: #929c95;
  font-size: 13px;
  font-weight: 650;
  place-items: center;
}

@media (prefers-reduced-motion: reduce) {
  .reward-card,
  .reward-card__inner,
  .reward-card-slot,
  .reward-create-card-slot,
  .reward-create-card,
  .reward-configuration__grid,
  .reward-list-move {
    animation: none;
    transition-duration: 1ms;
  }
}
</style>
