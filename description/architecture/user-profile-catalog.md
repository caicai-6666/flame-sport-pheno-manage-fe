# 工作台用户资料目录

工作台用户资料目录统一保存用户基础信息，并建立 `season_user_id → user_id → 用户资料` 的可复用关系。赛季结算、待终审、项目名单和奖品发放不再分别查询同一个用户。

> [!IMPORTANT]
> 目录只缓存姓名、部门和头像地址等相对稳定的用户资料。项目进度、最终积分和发放状态仍由对应业务接口刷新，不能使用用户目录替代。

---

## 数据模型

目录内部维护两张映射：

| 映射 | 键 | 值 | 用途 |
| --- | --- | --- | --- |
| 用户资料 | `user_id` | 姓名、部门、头像地址及已有展示状态 | 跨业务复用用户信息 |
| 赛季用户关系 | `season_user_id` | `user_id` | 从赛季参赛记录定位用户资料 |

`season_user_id` 是 `season_user` 的全局主键，因此不需要额外拼接 `season_id` 才能作为目录键。目录返回关系时仍同时保留两个 ID，避免调用方混淆。

## 写入流程

### 当前进行中赛季

当前赛季接口返回 `season_user_id` 和 `user_id` 后，工作台先调用 `linkSeasonUsers` 建立归属关系，再由用户详情接口只补齐目录中缺失的 `user_id`。

### 当前结算赛季

`POST /settlement/participants` 已经返回用户 ID、姓名、部门和头像地址。赛季结算面板调用 `saveSeasonUserProfiles`，在同一批校验后同时保存关系与用户资料，不再调用 `/user/user-info` 查询这些用户。

同一个 `season_user_id` 如果被绑定到不同 `user_id`，整批关系拒绝写入，避免产生部分成功的目录状态。

## 读取与刷新边界

- 结算待终审记录取得 `season_user_id` 后，使用 `getUserBySeasonUserId` 直接读取用户资料，不发起用户详情请求。
- 多条记录可以使用 `getUsersBySeasonUserIds` 按输入顺序组合关系。
- 已缓存的 `user_id` 再传给 `getOrLoad` 时不会重复请求用户详情接口。
- 管理员手动刷新赛季结算时仍重新请求结算参与者接口，因为项目进度、最终积分和发放状态可能变化。
- 工作台卸载或管理员退出时调用 `clear`，同时清除用户资料和赛季用户关系。

## 关联代码

- 用户目录：`src/services/userProfileCatalog.js`
- 工作台编排：`src/components/layout/MainWorkspaceShell.vue`
- 用户事务页面：`src/components/user-affairs/UserAffairsPage.vue`
- 赛季结算面板：`src/components/user-affairs/SeasonSettlementPanel.vue`
- 自动化测试：`tests/adminAuthentication.test.js`
