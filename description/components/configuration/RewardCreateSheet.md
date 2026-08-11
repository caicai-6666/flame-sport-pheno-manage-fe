# RewardCreateSheet

`RewardCreateSheet` 是奖品配置中的新增商品表单，从奖品内容容器底部升起，并采集商城商品的基础展示资料。

> [!NOTE]
> 当前表单只向父组件提交本地原型数据，尚未上传图片或调用真实商品创建接口。

---

## 组件职责

- 输入商品名称、商品描述和兑换积分。
- 选择 PNG、JPG 或 WebP 商品图片，并提供本地即时预览。
- 根据图片宽高比计算商品卡片的瀑布流展示高度。
- 校验名称、描述长度、积分范围、图片格式和图片大小。
- 支持关闭按钮、取消按钮、点击遮罩和按下 `Esc` 关闭。

---

## 使用方式

```vue
<RewardCreateSheet
  @cancel="closeCreateSheet"
  @submit="createReward"
/>
```

组件当前没有 `props` 或插槽。

---

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击关闭、取消、遮罩或按下 `Esc` 时 |
| `submit` | `{ name, description, pointsRequired, imageDataUrl, artworkHeight }` | 所有字段通过前端校验时 |

> [!IMPORTANT]
> `imageDataUrl` 只用于原型预览。接入接口后应提交原始文件或上传任务，并使用服务端返回的地址作为 `product.image_url`。

---

## 校验规则

- 商品名称必填，最多 128 个字符。
- 商品描述允许为空，最多 255 个字符。
- 兑换积分必须是 `0` 到 `4294967295` 之间的整数。
- 图片允许为空；选择图片时仅接受 PNG、JPG 或 WebP，最大 5 MB。
- 新商品在当前原型中默认使用 `status = 1`，即创建后展示。

---

## 依赖与关联代码

- 组件代码：`src/components/configuration/RewardCreateSheet.vue`
- 当前调用方：`src/components/configuration/RewardConfiguration.vue`
- 奖品概览：`description/components/configuration/RewardConfiguration.md`
- 商城功能：`description/features/mall-management.md`
- 商品结构：`description/db/product.md`
