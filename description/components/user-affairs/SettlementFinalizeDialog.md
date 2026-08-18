# SettlementFinalizeDialog

`SettlementFinalizeDialog` 是赛季一键结算的高风险确认弹窗，负责展示不可忽略的业务后果、校验管理员输入的当前赛季确认短语，并呈现真实接口的提交与成功汇总状态。

---

## 组件职责

- 展示当前赛季名称、红色高风险标题和透明惊讶表情图标。
- 惊讶图标在图片加载完成后再缓慢淡入、上浮并恢复正常比例，避免网络或缓存读取完成时突然闪现。
- 明确说明确认后会拒绝全部未完成审核的待初审与待终审凭证，并根据最终进度计算和发放积分。
- 生成 `我确认结算{赛季名称}` 完整确认短语。
- 输入与确认短语完全一致后才启用“最终结算”按钮。
- 未提交时支持取消按钮、遮罩点击和 `Esc` 关闭。
- 提交期间锁定关闭与重复提交，并显示旋转加载反馈。
- 成功后展示正式参赛、自动拒绝凭证、新定分和新发放人数。
- 打开后自动聚焦确认输入框，并向辅助技术提供弹窗标题和风险说明。

## 使用方式

```vue
<SettlementFinalizeDialog
  v-if="isFinalizeDialogOpen"
  :season-name="settlementSeason.name"
  :submit-message="finalizeSubmitMessage"
  :submitting="isFinalizingSettlement"
  :result="finalizeResult"
  @cancel="closeFinalizeDialog"
  @clear-message="finalizeSubmitMessage = ''"
  @confirm="handleFinalizeConfirmed"
/>
```

## Props

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `seasonName` | `String` | 是 | 无 | 当前唯一结算中赛季名称 |
| `submitMessage` | `String` | 否 | `''` | 接口失败后的安全提示 |
| `submitting` | `Boolean` | 否 | `false` | 一键结算请求是否进行中 |
| `result` | `Object \| null` | 否 | `null` | 成功响应的驼峰汇总数据；存在时切换为结果视图 |

## 事件

| 事件 | 参数 | 触发时机 |
| --- | --- | --- |
| `cancel` | 无 | 点击取消、点击遮罩或按下 `Esc` |
| `confirm` | 无 | 输入完全匹配并点击“最终结算” |
| `clear-message` | 无 | 管理员继续修改确认文字 |

## 插槽与暴露方法

当前未提供插槽或暴露方法。

## 主要状态与注意事项

- 确认短语不执行裁剪或模糊匹配，空格和赛季名称必须逐字一致。
- 提交按钮在输入未通过或请求进行中时禁用。
- `submitting = true` 时不触发 `cancel`，因为关闭前端无法取消已经到达服务端的数据库事务。
- 父组件负责请求 `POST /settlement/complete`、校验响应赛季归属，并在关闭成功结果后退出结算态。
- 接口失败时不清空输入，便于管理员核对服务端提示；无法确认网络结果时要求先关闭弹窗并刷新赛季状态，高风险请求不自动重试。
- 系统启用减少动态效果时取消输入、按钮和弹窗过渡。

## 依赖与关联代码

- 组件代码：`src/components/user-affairs/SettlementFinalizeDialog.vue`
- 父组件：`src/components/user-affairs/SeasonSettlementPanel.vue`
- 弹窗图标：`src/assets/用户事务/惊讶.webp`
- 功能说明：`description/features/user-affairs.md`
- 接口说明：`description/api/settlement/season-settlement.md`
