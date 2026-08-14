<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getAllProducts } from '../../api/product/productListApi.js'
import {
  createProduct,
  ProductCreateRequestError,
} from '../../api/product/productCreateApi.js'
import {
  ProductStatusUpdateRequestError,
  updateProductStatus,
} from '../../api/product/productStatusUpdateApi.js'
import {
  ProductUpdateRequestError,
  updateProduct,
} from '../../api/product/productUpdateApi.js'
import { loadProductImages } from '../../services/productImageLoader.js'
import {
  formatImageSize,
  processProductImage,
  ProductImageProcessingError,
} from '../../utils/productImageProcessor.js'
import RewardCreateSheet from './RewardCreateSheet.vue'

const rewardPalettes = [
  ['#e59462', '#f8d9b5', '#8d4f31'],
  ['#54a58e', '#bce4d5', '#2f685a'],
  ['#6387c9', '#c8d8f1', '#38527f'],
  ['#9b6bc0', '#dfcaed', '#5c3d78'],
  ['#d26f7f', '#f2c5cd', '#7b3e49'],
]

const rewardArtworkAspectRatios = [1.55, 1.24, 0.9, 1.72, 0.72]
const rewardArtworkPaths = [
  [
    'M31 14c-8 1-12 8-12 17 0 11 6 19 16 19s16-8 16-19c0-9-4-16-12-17',
    'M27 9h8v12h-8zM35 9h8v12h-8z',
  ],
  ['M18 13h36v34H18z', 'M18 22h36M29 13v34M42 13v34M23 39h26'],
  ['M25 16h22l-2 38H27z', 'M29 9h14v7H29zM31 25h10M30 34h12'],
  [
    'M13 37h41c5 0 8 3 8 8s-3 8-8 8H13z',
    'M54 37c-5 0-8 3-8 8s3 8 8 8 8-3 8-8-3-8-8-8zM13 37l8-17h34',
  ],
  [
    'M21 25h30l5 31H16z',
    'M27 25v-4c0-7 4-11 9-11s9 4 9 11v4M24 36h24M28 44h16',
  ],
]

const SAVE_CONFIRMATION_TIMEOUT_MS = 3000

const rewards = ref([])
const isProductListLoading = ref(false)
const isProductListLoaded = ref(false)
const productListError = ref('')
const productListNotice = ref('')

const editingRewardId = ref(null)
const rewardEditorSessionId = ref(0)
const masonryRef = ref(null)
const masonryWidth = ref(0)
const isCreateSheetOpen = ref(false)
const isRewardCreating = ref(false)
const rewardCreateError = ref('')
const validationMessage = ref('')
const imageValidationMessage = ref('')
const draft = ref(createEmptyDraft())
const originalDraft = ref(createEmptyDraft())
const isRewardSaving = ref(false)
const isSaveConfirmationActive = ref(false)
const isRewardImageProcessing = ref(false)

let sortTimerId = 0
let masonryObserver
let productListRequestController
let productImageRequestController
let productUpdateRequestController
let productCreateRequestController
let saveConfirmationTimerId = 0
const productImageObjectUrls = new Map()
const productStatusRequestControllers = new Map()

const MASONRY_GAP = 15
const CREATE_CARD_ID = 'create-reward'
const CREATE_CARD_HEIGHT = 196
// 比例换算高度过小时适度放大图片容器，确保正反两面始终使用同一完整尺寸。
const CARD_FULL_CONTENT_MIN_HEIGHT = 356

const masonryLayout = computed(() => {
  const availableWidth = masonryWidth.value || 900
  // 通过增加列数适度缩小卡片，而不是缩放或裁切图片，确保原始宽高比不变。
  const columnCount = availableWidth >= 820
    ? 4
    : availableWidth >= 620
      ? 3
      : availableWidth >= 420
        ? 2
        : 1
  const columnWidth = (availableWidth - MASONRY_GAP * (columnCount - 1)) / columnCount
  const columnHeights = Array.from({ length: columnCount }, () => 0)
  const positions = {}
  const artworkHeights = {}

  const layoutItems = isProductListLoaded.value
    ? [
        { id: CREATE_CARD_ID, height: CREATE_CARD_HEIGHT },
        ...rewards.value.map((reward) => {
          // 图片区始终使用原始宽高比；列宽变化时同步重算整张卡片高度。
          const naturalArtworkHeight = columnWidth / reward.imageAspectRatio
          const artworkHeight = Math.max(
            naturalArtworkHeight,
            CARD_FULL_CONTENT_MIN_HEIGHT,
          )
          artworkHeights[reward.id] = artworkHeight
          return {
            id: reward.id,
            height: artworkHeight,
          }
        }),
      ]
    : []

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
    artworkHeights,
  }
})

function createEmptyDraft() {
  return {
    name: '',
    description: '',
    points_required: '',
    image_url: '',
    imageFileName: '',
    imageFile: null,
    imageSize: 0,
    imageAspectRatio: 1,
  }
}

function cloneDraft(source) {
  return { ...source }
}

function createDraftFromReward(reward) {
  return {
    name: reward.name,
    description: reward.description ?? '',
    points_required: String(reward.points_required),
    image_url: reward.imagePreviewUrl ?? '',
    imageFileName: '',
    imageFile: null,
    imageSize: 0,
    imageAspectRatio: reward.imageAspectRatio,
  }
}

function createRewardView(product, index) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    points_required: product.pointsRequired,
    image_url: product.imageUrl,
    imagePreviewUrl: '',
    imageState: product.imageUrl ? 'loading' : 'empty',
    status: product.status,
    isStatusUpdating: false,
    statusUpdateMessage: '',
    imageAspectRatio: rewardArtworkAspectRatios[index % rewardArtworkAspectRatios.length],
    palette: rewardPalettes[index % rewardPalettes.length],
    artworkPaths: rewardArtworkPaths[index % rewardArtworkPaths.length],
  }
}

function normalizeImageAspectRatio(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1
  }
  return width / height
}

function measureRewardImage(reward, imageUrl) {
  const image = new Image()
  image.addEventListener('load', () => {
    if (reward.imagePreviewUrl !== imageUrl || image.naturalHeight <= 0) return
    reward.imageAspectRatio = normalizeImageAspectRatio(
      image.naturalWidth,
      image.naturalHeight,
    )
  }, { once: true })
  image.src = imageUrl
}

function releaseProductImageObjectUrls() {
  productImageObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  productImageObjectUrls.clear()
}

function startProductImageLoading(products, signal) {
  if (!products.some((product) => product.imageUrl)) return

  void loadProductImages(products, {
    signal,
    onImageLoaded({ imageUrl, productIds, blob }) {
      const objectUrl = URL.createObjectURL(blob)
      productImageObjectUrls.set(imageUrl, objectUrl)
      const productIdSet = new Set(productIds)
      rewards.value.forEach((reward) => {
        if (!productIdSet.has(reward.id) || reward.image_url !== imageUrl) return
        reward.imagePreviewUrl = objectUrl
        reward.imageState = 'loaded'
        measureRewardImage(reward, objectUrl)
      })
    },
    onImageFailed({ productIds }) {
      const productIdSet = new Set(productIds)
      rewards.value.forEach((reward) => {
        if (productIdSet.has(reward.id)) reward.imageState = 'failed'
      })
    },
  }).catch((error) => {
    // 认证失效由统一请求层切回登录视图；主动取消不应污染当前列表状态。
    if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') return
  })
}

async function loadProducts({ force = false } = {}) {
  if ((isProductListLoaded.value && !force) || isProductListLoading.value) return

  productListRequestController?.abort()
  productImageRequestController?.abort()
  releaseProductImageObjectUrls()
  productListRequestController = new AbortController()
  productImageRequestController = new AbortController()
  isProductListLoading.value = true
  isProductListLoaded.value = false
  productListError.value = ''
  cancelRewardEditing()

  try {
    const products = await getAllProducts({ signal: productListRequestController.signal })
    // 页面继续沿用积分升序；接口层保留后端 ID 升序，供其他调用方稳定复用。
    rewards.value = products
      .map(createRewardView)
      .sort((left, right) => left.points_required - right.points_required || left.id - right.id)
    isProductListLoaded.value = true
    startProductImageLoading(products, productImageRequestController.signal)
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') return
    rewards.value = []
    productListError.value = error?.message || '奖品列表暂时无法获取，请稍后重试'
  } finally {
    isProductListLoading.value = false
  }
}

async function openRewardEditor(reward) {
  window.clearTimeout(sortTimerId)
  isRewardImageProcessing.value = false
  rewardEditorSessionId.value += 1
  editingRewardId.value = reward.id
  reward.statusUpdateMessage = ''
  productListNotice.value = ''
  validationMessage.value = ''
  imageValidationMessage.value = ''
  clearSaveConfirmation()
  originalDraft.value = createDraftFromReward(reward)
  draft.value = cloneDraft(originalDraft.value)

  await nextTick()
  document.querySelector(`[data-reward-id="${reward.id}"] input[name="reward-name"]`)?.focus()
}

function leaveRewardEditor() {
  clearSaveConfirmation()
  isRewardImageProcessing.value = false
  rewardEditorSessionId.value += 1
  editingRewardId.value = null
  validationMessage.value = ''
  imageValidationMessage.value = ''
}

function cancelRewardEditing(force = false) {
  if (isRewardSaving.value && !force) return
  if (editingRewardId.value !== null) {
    // 取消时先恢复打开卡片时的快照，确保翻回动画和下次打开都不残留未提交修改。
    draft.value = cloneDraft(originalDraft.value)
  }
  leaveRewardEditor()
}

function finishRewardEditing() {
  // 保存后保留已提交草稿作为翻回动画内容，下一次打开仍会重新从奖品模型建立快照。
  originalDraft.value = cloneDraft(draft.value)
  leaveRewardEditor()
}

function openCreateSheet() {
  cancelRewardEditing(true)
  productListNotice.value = ''
  rewardCreateError.value = ''
  isCreateSheetOpen.value = true
}

function closeCreateSheet() {
  if (isRewardCreating.value) return
  isCreateSheetOpen.value = false
  rewardCreateError.value = ''
}

function clearRewardCreateError() {
  rewardCreateError.value = ''
}

async function createReward(payload) {
  if (isRewardCreating.value) return

  productCreateRequestController?.abort()
  const requestController = new AbortController()
  productCreateRequestController = requestController
  isRewardCreating.value = true
  rewardCreateError.value = ''

  try {
    const createdProduct = await createProduct({
      name: payload.name,
      description: payload.description,
      pointsRequired: payload.pointsRequired,
      imageFile: payload.imageFile,
    }, { signal: requestController.signal })
    if (productCreateRequestController !== requestController) return

    const reward = createRewardView(createdProduct, rewards.value.length)
    // 当前会话复用表单已经解码的 WebP，避免创建成功后立即重复请求同一图片。
    reward.imagePreviewUrl = payload.imageDataUrl
    reward.imageState = 'loaded'
    reward.imageAspectRatio = payload.imageAspectRatio
    rewards.value = [...rewards.value, reward].sort(
      (left, right) => left.points_required - right.points_required || left.id - right.id,
    )
    isCreateSheetOpen.value = false
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') return

    if (error instanceof ProductCreateRequestError && error.partiallyApplied) {
      const partialSuccessMessage = error.message
      productCreateRequestController = null
      isRewardCreating.value = false
      isCreateSheetOpen.value = false
      // 502 表示数据库可能已有新奖品，关闭旧草稿并重拉，防止管理员重复创建。
      await loadProducts({ force: true })
      productListNotice.value = productListError.value
        ? `${partialSuccessMessage}；奖品列表同步失败，请重新加载`
        : `${partialSuccessMessage}，已重新同步奖品列表`
      return
    }

    rewardCreateError.value = error instanceof ProductCreateRequestError
      ? error.message
      : '奖品创建失败，请稍后重试'
  } finally {
    if (productCreateRequestController === requestController) {
      productCreateRequestController = null
      isRewardCreating.value = false
    }
  }
}

function clearValidation() {
  // 二次确认只对应当时已检查的草稿，任一字段变化后必须重新确认。
  clearSaveConfirmation()
  validationMessage.value = ''
}

function clearSaveConfirmation() {
  window.clearTimeout(saveConfirmationTimerId)
  saveConfirmationTimerId = 0
  isSaveConfirmationActive.value = false
}

async function handleImageSelection(event) {
  const [file] = event.target.files ?? []
  const sessionId = rewardEditorSessionId.value
  const rewardId = editingRewardId.value
  imageValidationMessage.value = ''
  clearSaveConfirmation()

  if (!file) return

  isRewardImageProcessing.value = true
  try {
    const processedImage = await processProductImage(file)
    if (sessionId !== rewardEditorSessionId.value || rewardId !== editingRewardId.value) return
    draft.value.image_url = processedImage.dataUrl
    draft.value.imageFileName = processedImage.fileName
    draft.value.imageFile = processedImage.file
    draft.value.imageSize = processedImage.size
    draft.value.imageAspectRatio = processedImage.aspectRatio
  } catch (error) {
    if (sessionId !== rewardEditorSessionId.value || rewardId !== editingRewardId.value) return
    imageValidationMessage.value = error instanceof ProductImageProcessingError
      ? error.message
      : '奖品图片压缩失败，请重新选择'
    event.target.value = ''
  } finally {
    if (sessionId === rewardEditorSessionId.value && rewardId === editingRewardId.value) {
      isRewardImageProcessing.value = false
    }
  }
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

function createProductPatch(reward) {
  const normalizedName = draft.value.name.trim()
  const normalizedDescription = draft.value.description.trim() || null
  const normalizedPoints = Number(draft.value.points_required)
  const patch = {}

  if (normalizedName !== reward.name) patch.name = normalizedName
  if (normalizedPoints !== reward.points_required) patch.pointsRequired = normalizedPoints
  if (normalizedDescription !== (reward.description ?? null)) {
    patch.description = normalizedDescription
  }
  if (draft.value.imageFile) patch.imageFile = draft.value.imageFile
  return patch
}

async function saveReward(reward) {
  if (isRewardSaving.value || isRewardImageProcessing.value || reward.isStatusUpdating) return
  const message = validateDraft()
  if (message) {
    validationMessage.value = message
    return
  }

  const patch = createProductPatch(reward)
  if (Object.keys(patch).length === 0) {
    finishRewardEditing()
    return
  }

  validationMessage.value = ''
  if (!isSaveConfirmationActive.value) {
    isSaveConfirmationActive.value = true
    saveConfirmationTimerId = window.setTimeout(
      clearSaveConfirmation,
      SAVE_CONFIRMATION_TIMEOUT_MS,
    )
    return
  }

  clearSaveConfirmation()

  productUpdateRequestController?.abort()
  productCreateRequestController?.abort()
  const requestController = new AbortController()
  productUpdateRequestController = requestController
  isRewardSaving.value = true
  validationMessage.value = ''

  try {
    const updatedProduct = await updateProduct(reward.id, patch, {
      signal: requestController.signal,
    })
    if (productUpdateRequestController !== requestController) return

    reward.name = updatedProduct.name
    reward.description = updatedProduct.description
    reward.points_required = updatedProduct.pointsRequired
    reward.status = updatedProduct.status
    reward.image_url = updatedProduct.imageUrl
    if (draft.value.imageFile) {
      // 服务端生成唯一地址；当前会话直接复用已编码的 WebP 预览，避免成功后重复下载。
      reward.imagePreviewUrl = draft.value.image_url
      reward.imageState = 'loaded'
      reward.imageAspectRatio = draft.value.imageAspectRatio
    }
    finishRewardEditing()

    // 等待卡片翻回正面后再重排，价格变化时不会出现翻转过程中突然换位。
    sortTimerId = window.setTimeout(sortRewards, 720)
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') return

    if (error instanceof ProductUpdateRequestError && error.partiallyApplied) {
      const partialSuccessMessage = error.message
      productUpdateRequestController = null
      isRewardSaving.value = false
      // 502 可能发生在数据库提交后，必须舍弃旧草稿并重新获取服务端最终状态。
      await loadProducts({ force: true })
      productListNotice.value = productListError.value
        ? `${partialSuccessMessage}；奖品列表同步失败，请重新加载`
        : `${partialSuccessMessage}，已重新同步奖品列表`
      return
    }
    validationMessage.value = error instanceof ProductUpdateRequestError
      ? error.message
      : '奖品基本信息修改失败，请稍后重试'
  } finally {
    if (productUpdateRequestController === requestController) {
      productUpdateRequestController = null
      isRewardSaving.value = false
    }
  }
}

async function toggleRewardVisibility(reward) {
  if (reward.isStatusUpdating || isRewardSaving.value || isRewardImageProcessing.value) return

  clearSaveConfirmation()
  const nextStatus = reward.status === 0 ? 1 : 0
  const requestController = new AbortController()
  productStatusRequestControllers.get(reward.id)?.abort()
  productStatusRequestControllers.set(reward.id, requestController)
  reward.isStatusUpdating = true
  reward.statusUpdateMessage = ''

  try {
    const updatedProduct = await updateProductStatus(reward.id, nextStatus, {
      signal: requestController.signal,
    })
    if (productStatusRequestControllers.get(reward.id) !== requestController) return

    // 服务端明确该接口只改变 status；其余完整字段用于校验响应，不覆盖尚未保存的编辑草稿。
    reward.status = updatedProduct.status
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'AdminAuthenticationRequiredError') return
    reward.statusUpdateMessage = error instanceof ProductStatusUpdateRequestError
      ? error.message
      : '奖品上下架状态修改失败，请稍后重试'
  } finally {
    if (productStatusRequestControllers.get(reward.id) === requestController) {
      productStatusRequestControllers.delete(reward.id)
      reward.isStatusUpdating = false
    }
  }
}

onBeforeUnmount(() => {
  window.clearTimeout(sortTimerId)
  clearSaveConfirmation()
  masonryObserver?.disconnect()
  productListRequestController?.abort()
  productImageRequestController?.abort()
  productUpdateRequestController?.abort()
  productStatusRequestControllers.forEach((controller) => controller.abort())
  productStatusRequestControllers.clear()
  releaseProductImageObjectUrls()
})

onMounted(() => {
  masonryObserver = new ResizeObserver(([entry]) => {
    masonryWidth.value = entry.contentRect.width
  })
  if (masonryRef.value) masonryObserver.observe(masonryRef.value)
  void loadProducts()
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
        <span aria-live="polite">
          {{ isProductListLoading ? '正在加载…' : productListError ? '加载失败' : `${rewards.length} 件奖品` }}
        </span>
      </header>

      <p v-if="productListNotice" class="reward-configuration__notice" role="status">
        {{ productListNotice }}
      </p>

      <div v-show="isProductListLoaded" ref="masonryRef" class="reward-configuration__masonry">
        <TransitionGroup
          name="reward-list"
          tag="div"
          class="reward-configuration__grid"
          :style="{ height: `${masonryLayout.height}px` }"
        >
          <div
            v-if="isProductListLoaded"
            :key="CREATE_CARD_ID"
            class="reward-create-card-slot"
            :style="masonryLayout.positions[CREATE_CARD_ID]"
          >
            <button
              type="button"
              class="reward-create-card"
              aria-label="新增奖品"
              @click="openCreateSheet"
            >
              <span class="reward-create-card__plus" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span>
                <strong>新增奖品</strong>
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
            '--reward-artwork-height': `${masonryLayout.artworkHeights[reward.id]}px`,
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
                <img
                  v-if="reward.imagePreviewUrl"
                  :src="reward.imagePreviewUrl"
                  alt=""
                  class="reward-card__product-image"
                />
                <span
                  v-else-if="reward.imageState === 'loading'"
                  class="reward-card__image-loading"
                  aria-label="奖品图片加载中"
                >
                  <span class="reward-card__image-loading-orbit" aria-hidden="true"><i></i></span>
                  <small>图片加载中</small>
                </span>
                <svg v-else viewBox="0 0 72 64" aria-hidden="true">
                  <path v-for="path in reward.artworkPaths" :key="path" :d="path" />
                </svg>
                <small v-if="reward.status === 0">已下架</small>
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
              @keydown.esc.prevent="cancelRewardEditing()"
            >
              <header class="reward-card__editor-header">
                <button
                  type="button"
                  aria-label="取消修改并返回奖品正面"
                  :disabled="isRewardSaving"
                  @click="cancelRewardEditing()"
                >
                  <svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6" /></svg>
                </button>
                <div>
                  <small>奖品资料</small>
                  <h3>编辑奖品</h3>
                </div>
                <div class="reward-card__management-actions">
                  <button
                    type="button"
                    :class="{
                      'is-restore': reward.status === 0,
                      'is-updating': reward.isStatusUpdating,
                    }"
                    :disabled="reward.isStatusUpdating || isRewardSaving"
                    :aria-busy="reward.isStatusUpdating"
                    :aria-label="reward.status === 0 ? '上架奖品' : '下架奖品'"
                    :title="reward.status === 0 ? '上架奖品' : '下架奖品'"
                    @click="toggleRewardVisibility(reward)"
                  >
                    <svg v-if="reward.status === 0" viewBox="0 0 24 24">
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9a3 3 0 1 1 0 6" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24">
                      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM4 4l16 16" />
                    </svg>
                    <span v-if="reward.isStatusUpdating" class="reward-card__status-spinner" aria-hidden="true"></span>
                    <span>
                      {{ reward.isStatusUpdating
                        ? (reward.status === 0 ? '上架中' : '下架中')
                        : (reward.status === 0 ? '上架' : '下架') }}
                    </span>
                  </button>
                </div>
              </header>

              <div class="reward-card__editor-body">
                <label class="reward-card__image-editor">
                  <input
                    :key="`reward-image-${reward.id}-${rewardEditorSessionId}`"
                    type="file"
                    :disabled="isRewardSaving || isRewardImageProcessing"
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
                    <strong>{{ isRewardImageProcessing ? '正在压缩图片…' : draft.imageFileName || '更换奖品图片' }}</strong>
                    <small v-if="imageValidationMessage || draft.imageSize">
                      {{ imageValidationMessage || `已转为 WebP · ${formatImageSize(draft.imageSize)}` }}
                    </small>
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
                      :disabled="isRewardSaving"
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
                        :disabled="isRewardSaving"
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
                    :disabled="isRewardSaving"
                    maxlength="255"
                    rows="2"
                    @input="clearValidation"
                  ></textarea>
                </label>

                <p
                  class="reward-card__validation"
                  :class="{
                    'is-visible': validationMessage || reward.statusUpdateMessage || isSaveConfirmationActive,
                    'is-confirming': isSaveConfirmationActive,
                  }"
                  role="status"
                  aria-live="polite"
                >
                  {{ reward.statusUpdateMessage
                    || validationMessage
                    || (isSaveConfirmationActive ? '请在 3 秒内再次确认' : '请确认奖品资料') }}
                </p>
              </div>

              <footer class="reward-card__editor-footer">
                <button
                  type="submit"
                  :class="{
                    'is-confirming': isSaveConfirmationActive,
                    'is-saving': isRewardSaving,
                  }"
                  :disabled="isRewardSaving || isRewardImageProcessing || reward.isStatusUpdating"
                  :aria-pressed="isSaveConfirmationActive"
                >
                  <span v-if="isRewardSaving" class="reward-card__status-spinner" aria-hidden="true"></span>
                  {{ isRewardImageProcessing
                    ? '图片处理中'
                    : isRewardSaving
                      ? '保存中'
                      : isSaveConfirmationActive ? '确认保存' : '保存修改' }}
                  <span
                    v-if="isSaveConfirmationActive"
                    class="reward-card__save-progress"
                    aria-hidden="true"
                  ></span>
                </button>
              </footer>
            </form>
          </div>
        </article>
          </div>
        </TransitionGroup>
      </div>

      <div
        v-if="isProductListLoading"
        class="reward-configuration__state reward-configuration__state--loading"
        role="status"
      >
        <span aria-hidden="true"><i></i><i></i><i></i></span>
        <p>正在读取全部奖品</p>
      </div>
      <div v-else-if="productListError" class="reward-configuration__state" role="alert">
        <p>{{ productListError }}</p>
        <button type="button" @click="loadProducts({ force: true })">重新加载</button>
      </div>
      <p
        v-else-if="isProductListLoaded && rewards.length === 0"
        class="reward-configuration__empty"
      >暂无奖品</p>
    </div>

    <Transition name="reward-create-sheet">
      <RewardCreateSheet
        v-if="isCreateSheetOpen"
        :submitting="isRewardCreating"
        :submit-error="rewardCreateError"
        @cancel="closeCreateSheet"
        @clear-error="clearRewardCreateError"
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

.reward-configuration__notice {
  margin: -10px 0 16px;
  padding: 9px 13px;
  color: #8b5a3e;
  font-size: 11px;
  font-weight: 650;
  background: rgb(255 244 232 / 72%);
  border: 1px solid rgb(214 132 79 / 16%);
  border-radius: 12px;
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
  position: relative;
  padding: 0;
  background: rgb(248 250 247 / 24%);
  backdrop-filter: blur(16px) saturate(0.82);
  cursor: pointer;
  transition: box-shadow 520ms ease;
}

.reward-card:hover .reward-card__front {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 95%),
    0 23px 45px color-mix(in srgb, var(--reward-primary) 18%, transparent);
}

.reward-card__artwork {
  position: absolute;
  inset: 0;
  display: grid;
  width: 100%;
  height: 100%;
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
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reward-card__product-image {
  animation: reward-product-image-reveal 820ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.reward-card__image-loading {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: grid;
  overflow: hidden;
  background:
    radial-gradient(circle at 72% 20%, rgb(255 255 255 / 60%), transparent 28%),
    radial-gradient(circle at 20% 86%, color-mix(in srgb, var(--reward-primary) 25%, transparent), transparent 38%),
    linear-gradient(135deg, color-mix(in srgb, var(--reward-secondary) 55%, white), rgb(245 247 242 / 78%));
  grid-template-rows: auto auto;
  align-content: center;
  justify-items: center;
  gap: 9px;
  place-items: center;
}

.reward-card__image-loading::before {
  position: absolute;
  inset: -45% -70%;
  background: linear-gradient(105deg, transparent 38%, rgb(255 255 255 / 38%) 49%, transparent 60%);
  content: '';
  animation: reward-image-shimmer 2.4s ease-in-out infinite;
}

.reward-card__image-loading-orbit {
  position: relative;
  z-index: 1;
  display: grid;
  width: 44px;
  height: 44px;
  background: rgb(255 255 255 / 42%);
  border: 1px solid rgb(255 255 255 / 66%);
  border-radius: 50%;
  box-shadow:
    0 11px 24px rgb(73 68 58 / 8%),
    0 0 0 8px rgb(255 255 255 / 13%);
  place-items: center;
  animation: reward-image-loader-breathe 1.8s ease-in-out infinite;
}

.reward-card__image-loading-orbit i {
  width: 19px;
  height: 19px;
  border: 2px solid color-mix(in srgb, var(--reward-primary) 20%, transparent);
  border-top-color: color-mix(in srgb, var(--reward-primary) 82%, var(--reward-ink));
  border-radius: 50%;
  animation: reward-image-spin 850ms linear infinite;
}

.reward-card__image-loading > small {
  position: relative;
  z-index: 1;
  color: color-mix(in srgb, var(--reward-ink) 72%, #6f7872);
  font-size: 10px;
  font-weight: 720;
  letter-spacing: 0.08em;
  animation: reward-image-label-breathe 1.8s ease-in-out infinite;
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
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  min-height: 0;
  height: 116px;
  padding: 11px 16px 12px;
  flex-direction: column;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 43%), rgb(239 245 240 / 25%));
  border-top: 1px solid rgb(255 255 255 / 45%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%);
  backdrop-filter: blur(18px) saturate(0.82);
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
  width: 27px;
  height: 27px;
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
  line-height: 1.45;
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
  overflow: hidden;
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

.reward-card__management-actions button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.reward-card__status-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: reward-status-spin 720ms linear infinite;
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

.reward-card__validation.is-confirming {
  color: #b56e41;
}

.reward-card__editor-footer {
  display: grid;
  margin-top: 4px;
  grid-template-columns: 1fr;
}

.reward-card__editor-footer button {
  position: relative;
  isolation: isolate;
  display: inline-flex;
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
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition:
    color 320ms ease,
    background 420ms ease,
    border-color 320ms ease,
    box-shadow 320ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reward-card__editor-footer button:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.reward-card__editor-footer button:last-child {
  color: white;
  background: linear-gradient(120deg, var(--reward-primary), var(--reward-ink));
  border-color: transparent;
  box-shadow: 0 10px 20px color-mix(in srgb, var(--reward-primary) 22%, transparent);
}

.reward-card__editor-footer button.is-confirming {
  color: var(--reward-ink);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 90%), rgb(255 255 255 / 68%)),
    var(--reward-secondary);
  border-color: color-mix(in srgb, var(--reward-primary) 34%, white);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--reward-primary) 8%, transparent),
    0 10px 22px color-mix(in srgb, var(--reward-primary) 18%, transparent);
  transform: translateY(-1px) scale(1.012);
}

.reward-card__save-progress {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--reward-primary);
  border-radius: 999px;
  transform-origin: left center;
  animation: reward-save-confirmation-countdown 3s linear forwards;
}

.reward-card__editor-footer button:hover {
  box-shadow: 0 10px 20px rgb(48 65 54 / 12%);
  transform: translateY(-2px);
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

.reward-configuration__state {
  display: grid;
  min-height: 260px;
  align-content: center;
  justify-items: center;
  gap: 13px;
  color: #7e8a82;
  text-align: center;
}

.reward-configuration__state p {
  max-width: 430px;
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}

.reward-configuration__state > button {
  padding: 8px 15px;
  color: #925a3e;
  font: inherit;
  font-size: 12px;
  font-weight: 730;
  background: rgb(255 255 255 / 68%);
  border: 1px solid rgb(211 126 78 / 24%);
  border-radius: 999px;
  cursor: pointer;
}

.reward-configuration__state--loading > span {
  display: flex;
  height: 22px;
  align-items: flex-end;
  gap: 5px;
}

.reward-configuration__state--loading i {
  width: 6px;
  height: 6px;
  background: #d78a5e;
  border-radius: 50%;
  animation: reward-list-loading-dot 900ms ease-in-out infinite alternate;
}

.reward-configuration__state--loading i:nth-child(2) {
  animation-delay: 120ms;
}

.reward-configuration__state--loading i:nth-child(3) {
  animation-delay: 240ms;
}

@keyframes reward-product-image-reveal {
  from {
    opacity: 0;
    filter: blur(14px) saturate(0.7);
    transform: scale(1.045);
  }
}

@keyframes reward-image-spin {
  to { transform: rotate(1turn); }
}

@keyframes reward-image-shimmer {
  0%, 16% { transform: translateX(-34%); }
  72%, 100% { transform: translateX(34%); }
}

@keyframes reward-image-loader-breathe {
  50% {
    box-shadow:
      0 14px 29px rgb(73 68 58 / 11%),
      0 0 0 13px rgb(255 255 255 / 8%);
    transform: scale(1.045);
  }
}

@keyframes reward-image-label-breathe {
  50% { opacity: 0.58; }
}

@keyframes reward-list-loading-dot {
  to { transform: translateY(-8px); }
}

@keyframes reward-status-spin {
  to { transform: rotate(1turn); }
}

@keyframes reward-save-confirmation-countdown {
  to { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .reward-card,
  .reward-card__inner,
  .reward-card-slot,
  .reward-create-card-slot,
  .reward-create-card,
  .reward-card__product-image,
  .reward-card__image-loading::before,
  .reward-card__image-loading-orbit,
  .reward-card__image-loading-orbit i,
  .reward-card__image-loading > small,
  .reward-card__status-spinner,
  .reward-card__save-progress,
  .reward-configuration__state--loading i,
  .reward-configuration__grid,
  .reward-list-move {
    animation: none;
    transition-duration: 1ms;
  }
}
</style>
