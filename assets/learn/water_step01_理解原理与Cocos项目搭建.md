# Step 01：理解原理与 Cocos Creator 项目搭建

## 1. 需求是什么

我们要做一个 **2D 水面**：物体掉进去会产生波浪，波浪向两边扩散，最终恢复平静。还可以加上随机水花和自动流动效果。

### 核心物理原理

把水面想象成一条由很多"弹簧"组成的线：

```
  ↓ 物体砸下来
  ●
 / \
●   ●   ●   ●   ●   ●   ●  ← 水面上的弹簧点
─────────────────────────────  ← 水面静止位置
```

三条规则，搞定整个水面效果：
1. **弹力把它弹回来** → 胡克定律：`F = -k × x`（偏离越远，拉力越大）
2. **阻尼让它停下来** → 阻尼力：`F = -c × v`（速度越快，阻力越大）
3. **高度差传递给邻居** → 传播力：`F = spread × (自己高度 - 邻居高度)`

### Cocos Creator 版 vs Unity 版的核心区别

| 概念 | Unity | Cocos Creator |
|------|-------|---------------|
| 水面形状 | SpriteShapeController + Spline | **Graphics 组件**（每帧画多边形） |
| 弹簧 | 独立 GameObject + 预制体 | **纯数据数组**（heights[], velocities[]） |
| 碰撞检测 | OnCollisionEnter2D | **Contact2DType.BEGIN_CONTACT** |
| Shader | ShaderGraph | **.effect 文件** |
| 语言 | C# | **TypeScript** |

**Cocos 版的架构更干净**——只需要**一个节点、一个脚本、一个内置组件**：

```
Water (Node)
├── WaterController.ts   ← 唯一的脚本：物理 + 绘制 + 碰撞，全在这里
└── Graphics             ← 内置组件：画水面多边形
```

不需要预制体，不需要子节点，不需要 Spline。弹簧就是两个 `number[]` 数组。

### 水面的绘制原理

每一帧用 `Graphics` 组件画一个多边形：

```
左下 ──────────────────────── 右下
  |                              |
  |          水体填充              |
  |                              |
左上 ~~ S0 ~~ S1 ~~ S2 ~~ S3 ~~ 右上
       ↑     ↑     ↑     ↑
       弹簧点（高度会变化）
```

上边缘跟着弹簧点走，下边缘不动 → 每帧清除重画 → 水面就"动"起来了。

## 2. 具体操作步骤

### 2.1 创建 / 打开 Cocos Creator 项目

你已经有了 `cocos_shade` 项目，直接用它。如果是新项目：
1. 打开 Cocos Dashboard → **New Project** → 选 **2D** 模板
2. 项目名随意，比如 `Water2D`

### 2.2 确认 2D 物理模块已启用

1. 菜单栏 → **Project** → **Project Settings**
2. 左侧选 **Feature Crop** 或 **Module Config**
3. 确认 **Physics 2D** → **box2d** 已勾选（默认应该已开启）

> 项目的 `settings/v2/packages/engine.json` 中已有 `physics-2d-box2d` 模块。

### 2.3 创建水体节点

1. 在 **Hierarchy** 面板中，找到你的 Canvas（或场景根节点）
2. 右键 → **Create** → **Empty Node**，命名为 `Water`
3. 选中 `Water` 节点，在 **Inspector** 中：
   - 确保有 **UITransform** 组件（创建节点时自动添加）
   - 点击 **Add Component** → **2D** → **Graphics**
4. 调整 `Water` 节点的位置到场景下方（水面应该在场景中偏下的位置）

### 2.4 创建脚本文件

1. 在 **Assets** 面板中，找到或创建 `scripts` 文件夹
2. 右键 → **Create** → **TypeScript** → **NewComponent**
3. 命名为 `WaterController`

此时文件夹结构：

```
assets/
├── scripts/
│   └── WaterController.ts   ← 我们的水控制器（唯一需要的脚本）
└── ...
```

### 2.5 将脚本挂载到水体节点

1. 选中 `Water` 节点
2. **Inspector** → **Add Component** → 搜索 `WaterController` → 添加

### 2.6（可选）创建测试掉落物

为了后面测试碰撞，先建一个球：

1. 右键 Canvas → **Create** → **2D Object** → **Sprite**，命名为 `Ball`
2. 放到水面**上方**
3. 给它添加组件：
   - **RigidBody2D**（Type 选 **Dynamic**，让它受重力掉下来）
   - **CircleCollider2D**（碰撞体）
   - 调整 **CircleCollider2D** 的 `Radius`

## 3. 验收标准

- [ ] Cocos Creator 项目打开正常
- [ ] 2D 物理模块已启用（box2d）
- [ ] 场景中有 `Water` 节点，位于 Canvas 下
- [ ] `Water` 节点上有 **UITransform** + **Graphics** 组件
- [ ] `WaterController.ts` 脚本已创建并挂载到 `Water` 节点
- [ ] （可选）场景中有 `Ball` 节点，带 RigidBody2D + CircleCollider2D
- [ ] 运行项目无报错

> **小白常见问题**：
> - Q: Graphics 组件找不到？ → 在 Add Component 搜索时选 **2D** 分类下的 **Graphics**
> - Q: 2D 物理模块怎么确认？ → 菜单 Project → Project Settings → Feature Crop
> - Q: Ball 不掉下来？ → 检查 RigidBody2D 的 Type 是否为 Dynamic，GravityScale 是否 > 0
