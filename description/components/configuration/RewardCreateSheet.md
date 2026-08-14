# RewardCreateSheet

`RewardCreateSheet` 是奖品配置中的新增奖品表单，从奖品内容容器底部升起，并采集商城奖品的基础展示资料。

> [!NOTE]
> 当前表单通过父组件调用真实奖品创建接口。请求期间锁定全部输入与关闭入口，只有 `201 Created` 才结束创建流程。

---

## 组件职责

- 输入奖品名称、奖品描述和兑换积分。
- 选择 PNG、JPG 或 WebP 奖品图片，在浏览器端等比压缩并转成 WebP 后提供预览。
- 提交处理后的 WebP 文件、预览地址与宽高比，由奖品瀑布流结合实时列宽计算整张卡片高度。
- 校验名称、描述长度、积分范围、图片格式和图片大小。
- 创建按钮使用 3 秒限时二次确认，只有连续两次确认后才向父组件提交草稿。
- 支持右上角关闭按钮、点击遮罩和按下 `Esc` 关闭；底部不重复提供取消按钮。

---

## 使用方式

```vue
<RewardCreateSheet
  @cancel="closeCreateSheet"
  @submit="createReward"
/>
```

组件当前没有插槽。

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `submitting` | `Boolean` | 否 | `false` | 创建请求是否进行中；为真时锁定表单和关闭入口 |
| `submitError` | `String` | 否 | `''` | 创建接口返回的安全错误提示 |

---

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击右上角关闭、遮罩或按下 `Esc` 时 |
| `clear-error` | 无 | 草稿或图片变化时请求父组件清除旧接口错误 |
| `submit` | `{ name, description, pointsRequired, imageDataUrl, imageFile, imageAspectRatio }` | 所有字段通过前端校验，并在 3 秒内完成二次确认时 |

> [!IMPORTANT]
> 选择 PNG、JPG 或 WebP 后，前端按原始宽高比将最长边限制为 1600px，再逐级调整 WebP 编码质量与等比尺寸，目标压缩至约 300KB。`imageDataUrl` 只用于预览，`imageFile` 是处理后的 `image/webp` 文件，供后续上传接口直接使用；服务端最终返回地址才可写入 `product.image_url`。

---

## 校验规则

- 奖品名称必填，最多 128 个字符。
- 奖品描述允许为空，最多 255 个字符。
- 兑换积分必须是 `0` 到 `4294967295` 之间的整数。
- 图片必填；选择图片时接受 PNG、JPG 或 WebP，原图最大 5 MB，输出最长边不超过 1600px，并在保持宽高比的前提下以约 300KB 为压缩目标。请求上传的最终文件固定为 `image/webp`。
- 新奖品在当前原型中默认使用 `status = 1`，即创建后展示。

首次点击“创建奖品”只进入“确认创建”状态并显示倒计时条；3 秒内再次点击才提交。超时、修改名称/描述/积分、重新选择图片或按下 `Esc` 都会退出确认态，其中 `Esc` 第一次只取消确认，再次按下才关闭弹窗。提交后父组件使用 `multipart/form-data` 调用 `/product/create`，成功时采用服务端生成的 ID 和图片地址；`502` 时关闭旧草稿并重拉列表确认部分成功状态。

---

## 依赖与关联代码

- 组件代码：`src/components/configuration/RewardCreateSheet.vue`
- 当前调用方：`src/components/configuration/RewardConfiguration.vue`
- 奖品概览：`description/components/configuration/RewardConfiguration.md`
- 商城功能：`description/features/mall-management.md`
- 商品结构：`description/db/product.md`
