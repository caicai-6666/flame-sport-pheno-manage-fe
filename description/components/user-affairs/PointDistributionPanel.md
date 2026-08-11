# PointDistributionPanel

`PointDistributionPanel` 用于选择一个已结束赛季，并查看该赛季各用户的挑战等级、项目完成进度和积分发放状态。

> [!IMPORTANT]
> 当前组件使用本地原型数据。点击“发放积分”只更新页面状态，不会写入用户积分或生成积分流水。

---

## 组件职责

- 只提供 `status = 2` 的已结束赛季作为选择范围。
- 切换赛季后展示该赛季对应的用户积分发放列表。
- 为每个用户展示名称、所属部门、赛季统一挑战等级、各已选项目进度和本次发放积分。
- 项目进度在单个用户行内纵向排列，每项均按“项目名称、进度条、百分比”从左到右展示。
- 未发放记录展示“发放积分”按钮；提交期间禁止重复点击。
- 已发放记录使用静态状态文字，不继续呈现按钮外观。
- 当前赛季全部记录发放完成后显示“导出 Excel”，生成该赛季的 `.xlsx` 明细文件。
- 列表内容独立滚动，不带动管理端根页面移动。

## 使用方式

```vue
<PointDistributionPanel />
```

## Props、事件与插槽

当前未提供。原型状态由组件内部维护。

---

## 列表字段

| 展示内容 | 数据依据 | 说明 |
| --- | --- | --- |
| 用户名称 | `user.name` | 原型同时展示部门作为辅助识别信息 |
| 挑战等级 | `season_user.level_id` 关联 `project_level.name` | 同一用户赛季内的全部项目共用一个等级 |
| 项目完成进度 | `season_user_project.completion_progress` | 页面转换为 `0%～100%` 展示 |
| 发放积分 | `season_user.final_points` | 展示该用户本赛季最终结算所得积分，不由前端根据等级计算 |
| 发放状态 | 待后端契约确认 | 原型使用组件内布尔状态 |

> [!WARNING]
> `season_user.final_points` 可以区分尚未结算与已结算结果，但当前 `point_record` 没有 `season_id`。因此前端不能仅凭现有数据库结构可靠判断某个赛季奖励是否已经发放，真实状态与发放接口必须由后端契约明确。

## 主要状态与异常处理

- 默认选择最近一个已结束赛季。
- 发放中按钮进入短暂加载状态并禁止重复提交。
- 原型发放完成后，按钮平滑切换为带勾选图标的“已发放”文字。
- 仅当当前赛季存在用户且全部为已发放状态时显示导出入口。
- 导出期间按钮显示生成状态并禁止重复点击；生成失败时在选择器旁提示重试。
- 切换用户事务分类时组件保持挂载，本地选择与发放状态不会重置。
- 接入接口后需要补充加载、空数据、请求失败、权限不足和并发发放冲突处理。

## Excel 导出

工作簿包含一个“积分发放明细”工作表，字段包括：

- 序号、用户名称、所属部门和挑战等级。
- 按用户项目数量动态展开的项目名称与项目进度列。
- 发放积分和发放状态。

项目进度以 Excel 百分比数值写入，积分以整数写入，因此导出后仍可继续筛选、排序与计算。表头启用筛选，并冻结标题与表头区域。

Excel 能力通过 `exceljs` 实现，并使用动态导入，仅在管理员点击导出时加载对应代码。

## 依赖与关联代码

- 组件代码：`src/components/user-affairs/PointDistributionPanel.vue`
- 导出工具：`src/utils/exportSeasonPointDistribution.js`
- 页面组件：`src/components/user-affairs/UserAffairsPage.vue`
- 赛季：`description/db/season.md`
- 用户赛季参与：`description/db/season_user.md`
- 用户项目进度：`description/db/season_user_project.md`
- 挑战等级：`description/db/project_level.md`
- 积分流水：`description/db/point_record.md`
