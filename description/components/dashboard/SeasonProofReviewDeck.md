# SeasonProofReviewDeck

`SeasonProofReviewDeck` 是当前赛季卡片背面的运动记录终审卡组，用于让管理员逐条查看凭证并快速作出通过或拒绝决定。

> [!IMPORTANT]
> 当前组件只实现视觉原型与本地状态流转。走路记录使用三张假记录拼接成的纵向长图，其余人员信息和进度数据仍为演示数据，尚未接入终审接口。

---

## 组件职责

- 展示当前待审核记录及下一条记录的堆叠预览。
- 在固定高度的独立视窗中展示纵向拼接凭证，允许审核员滚动查看完整图片。
- 悬浮或键盘聚焦凭证顶部的用户项目标签时，展示该用户的挑战等级和当前项目目标要求。
- 将用户备注和模型评语组织为带身份节点与连接线的连续审核对话。
- 将管理员评语输入框与通过、拒绝操作组合成底部回复编辑器，并随审核决定一并提交。
- 提供“通过”和“拒绝”两个明确的终审动作。
- 审核后播放方向不同的离场动画，并自动切换到下一条记录。
- 全部处理完成后展示完成状态，并允许返回当前赛季信息。

组件不负责请求待审记录、持久化终审结果、回退项目进度或执行进度回补。

---

## 使用方式

```vue
<script setup>
import SeasonProofReviewDeck from './components/dashboard/SeasonProofReviewDeck.vue'

const records = [
  {
    id: 'proof-1',
    userName: '周予安',
    projectName: '跑步',
    proofDate: '2026-08-10',
    proofDateLabel: '08.10',
    challengeLevel: '黄金',
    targetRequirement: '单次距离：≥ 5 公里',
    imageUrl: '/proof-placeholder.png',
    isImagePlaceholder: false,
    note: '完成本次跑步挑战。',
    reviewComment: '初审通过：距离与日期清晰，符合单次要求。',
    tone: 'violet',
  },
]
</script>

<template>
  <SeasonProofReviewDeck
    :records="records"
    @close="handleClose"
    @reviewed="handleReviewed"
  />
</template>
```

## Props

| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `records` | `Array` | 是 | 按审核顺序排列的运动凭证数组 |

每条记录当前使用以下展示字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 凭证唯一标识 |
| `userName` | 用户姓名，用于凭证顶部的轻量身份标签 |
| `projectName` | 运动项目名称 |
| `challengeLevel` | 用户为整个赛季锁定的统一挑战等级 |
| `targetRequirement` | 当前运动项目在该等级下需要核对的目标要求摘要 |
| `proofDate`、`proofDateLabel` | 标准日期与页面显示日期 |
| `imageUrl` | 纵向拼接凭证图片地址；按图片原始宽高比显示 |
| `isImagePlaceholder` | 是否为原型占位图；为 `true` 时居中展示且不启用图片滚动提示 |
| `note` | 用户填写的运动备注 |
| `reviewComment` | 当前审核评语；进入终审时保存的是模型初审评语 |
| `tone` | 凭证图片区的原型配色标识 |

## 事件

| 事件名 | 参数 | 触发时机 |
| --- | --- | --- |
| `close` | 无 | 点击返回按钮或完成状态中的返回按钮时 |
| `reviewed` | `{ recordId, reviewStatus, reviewComment }` | 当前卡片离场动画结束、切换下一条记录前 |

`reviewStatus` 当前只会是 `approved` 或 `rejected`。

## 插槽与暴露方法

当前未提供。

---

## 状态与交互

组件始终把 `records` 的第一项视为当前记录、第二项视为下一张预览。管理员必须先填写终审评语，才能执行通过或拒绝；未填写时组件显示校验提示并将焦点移入输入框。点击审核按钮后，输入框和按钮会暂时禁用，防止动画期间重复提交；当前记录离场后触发 `reviewed`，由调用方从队列中移除已处理记录。

卡片主体优先分配给凭证图片。底部固定为审核对话链：用户与模型内容使用更大的双行文字展示，管理员回复编辑器和两个决策按钮位于同一行，减少传统表单的分区感。

凭证顶部的用户、项目与日期标签支持鼠标悬浮和键盘聚焦。信息浮层只用于补充审核上下文，不遮挡标签本身；挑战等级来自用户的赛季级选择，目标要求则应由当前项目与该等级对应的项目规则生成。

凭证图片区具有独立的纵向滚动上下文。图片起始位置贴齐展示框顶部，滚动到末尾时贴齐底部；滚动位置被限制在有效范围内，触控惯性到达边缘时不会继续越界或露出框外区域。鼠标滚轮、触控手势和键盘滚动只移动凭证图片，人员信息、审核依据与操作按钮保持在卡片中可见。切换到下一条记录时，新卡片会重新挂载，因此滚动位置自动回到图片顶部。

- `approved`：卡片向右上方滑出。
- `rejected`：卡片向左上方滑出。
- 返回按钮悬浮时轻微上浮并推动箭头向左，按下时短促回弹。
- 无剩余记录：显示“今日记录已审核完成”。
- 系统启用减少动态效果时：缩短切换等待并移除大幅滑动动画。

> [!NOTE]
> 审核进度由调用方持有，因此终审面板卸载或切换到其他待办页面后，再次打开仍会从尚未处理的记录继续。尚未提交的管理员评语只保存在当前组件实例内，组件卸载后不保证保留。

### 评语覆盖规则

模型初审完成后，`reviewComment` 保存模型评语。终审界面将该值只读展示，管理员输入框默认为空；管理员提交终审后，事件中的新 `reviewComment` 应覆盖原模型评语。

> [!IMPORTANT]
> 当前设计复用数据库中的同一个 `proof_record.review_comment` 字段，不同时保存两份评语。页面上的模型评语仅是覆盖发生前的当前值。

---

## 业务与接口边界

只有 `review_status = preliminary_approved` 且记录有效的凭证可以进入管理员终审队列。真实提交成功后，后端才能将状态更新为 `approved` 或 `rejected`。

终审拒绝涉及凭证 `increase` 清零、项目进度回退和其他有效凭证回补。这些操作必须由后端在同一业务事务中完成，前端不能仅通过修改页面数据模拟最终业务结果。

> [!WARNING]
> 当前没有管理端终审接口契约。接入前需确认列表分页、长图访问方式与尺寸限制、评语覆盖的提交方式、并发冲突处理和提交失败后的恢复策略，不得从数据库字段自行推断接口路径。

## 依赖与关联代码

- 组件代码：`src/components/dashboard/SeasonProofReviewDeck.vue`
- 当前调用方：`src/components/layout/MainWorkspaceShell.vue`
- 长图测试资源：`src/assets/test/proof-record-long.png`
- 功能说明：`description/features/proof-review.md`
- 凭证结构：`description/db/proof_record.md`
- 项目进度：`description/db/season_user_project.md`
- 项目规则：`description/db/project_rule.md`
