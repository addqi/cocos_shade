# Step 01：理解闪电原理与 Cocos Creator 项目搭建

## 1. 需求是什么

我们要做一个 **2D 动态闪电**：从 A 点到 B 点释放一道随机路径的闪电，不断闪烁，像真正的电弧一样。

### 核心物理原理——中点位移算法

闪电的本质是一条**随机锯齿线**。怎么生成？

```
第 0 轮：一条直线
A ─────────────────────── B

第 1 轮：取中点 M，垂直方向随机偏移
A ──────── M' ──────── B
              ↑ 偏移

第 2 轮：每条线段再取中点偏移
A ─── M1' ─── M' ─── M2' ─── B

第 3 轮：继续...
A ─ · ─ M1' ─ · ─ M' ─ · ─ M2' ─ · ─ B

规律：
- 第 N 轮产生 2^N 条线段
- 每轮偏移量减半（远处粗糙，近处精细）
- 这就是"分形"
```

关键参数只有两个：
1. **subdivision（递归次数）**：决定闪电精细度。5 次 = 32 段，6 次 = 64 段
2. **chaosFactor（混乱系数）**：决定偏移幅度。0.1 = 温和弧线，0.3 = 疯狂锯齿

### "偏移方向"怎么算？

在 3D（Unity 版）中需要用 `Quaternion.AngleAxis` 做旋转，很复杂。

在 2D 中，垂直方向就是把方向向量旋转 90°，数学上极其简单：

```
方向向量：(dx, dy)
垂直向量：(-dy, dx)

例：方向是 (1, 0)（水平向右）
    垂直是 (0, 1)（垂直向上）✅

例：方向是 (3, 4)（斜向右上）
    垂直是 (-4, 3)（斜向左上）✅
```

这就是 2D 版比 Unity 版简洁的根本原因——**数据结构对了，代码自然简单**。

### Cocos Creator 版 vs Unity 版的核心区别

| 概念 | Unity | Cocos Creator |
|------|-------|---------------|
| 画线 | LineRenderer（设置顶点数组） | **Graphics**（moveTo/lineTo） |
| 定时刷新 | Coroutine + yield | **update + 计时器** |
| 材质纹理切换 | mainTextureOffset | 不需要（用颜色/线宽分层） |
| 垂直方向计算 | Quaternion.AngleAxis（10行） | **(-dy, dx)**（1行） |
| 随机数 | System.Random 实例 | **Math.random()** |

**Cocos 版的架构极简**——一个节点、一个脚本、一个组件：

```
Lightning (Node)
├── LightningController.ts   ← 唯一脚本
├── Graphics                  ← 内置 2D 画线组件
│
├── StartPoint (空节点)        ← 起点位置
└── EndPoint (空节点)          ← 终点位置
```

## 2. 具体操作步骤

### 2.1 创建闪电节点

1. 在 **Hierarchy** 面板中，右键 Canvas → **Create** → **Empty Node**，命名为 `Lightning`
2. 选中 `Lightning` 节点，**Inspector** 中：
   - 确认有 **UITransform** 组件
   - 点击 **Add Component** → **2D** → **Graphics**

### 2.2 创建起点和终点

1. 右键 `Lightning` 节点 → **Create** → **Empty Node**，命名为 `StartPoint`
2. 再创建一个，命名为 `EndPoint`
3. 调整位置：
   - `StartPoint` 的 Position 设为 `(-200, 150, 0)`
   - `EndPoint` 的 Position 设为 `(200, -150, 0)`

此时节点树：

```
Canvas
└── Lightning
    ├── StartPoint   (x: -200, y: 150)
    └── EndPoint     (x: 200, y: -150)
```

### 2.3 创建脚本文件

1. 在 **Assets** 面板中，找到 `assets/gameComponet/lightning/` 文件夹
2. 右键 → **Create** → **TypeScript** → **NewComponent**
3. 命名为 `LightningController`

### 2.4 挂载脚本

1. 选中 `Lightning` 节点
2. **Inspector** → **Add Component** → 搜索 `LightningController` → 添加
3. 将 `StartPoint` 拖到 Inspector 的 `Start Node` 属性上
4. 将 `EndPoint` 拖到 Inspector 的 `End Node` 属性上

## 3. 验收标准

- [ ] 场景中有 `Lightning` 节点，在 Canvas 下
- [ ] `Lightning` 节点上有 **UITransform** + **Graphics** 组件
- [ ] `Lightning` 下有 `StartPoint` 和 `EndPoint` 两个子节点，位置不同
- [ ] `LightningController.ts` 脚本已创建（目前是空的，下一步开始写代码）
- [ ] 脚本已挂载到 `Lightning` 节点
- [ ] 运行项目无报错

> **小白常见问题**：
> - Q: Graphics 组件找不到？ → 在 Add Component 搜索时选 **2D** 分类下的 **Graphics**
> - Q: 起点和终点为什么要做成子节点？ → 方便在编辑器里拖动调整位置，也方便运行时通过代码移动
> - Q: 为什么不直接用坐标数字？ → 用节点引用更灵活，可以让起点/终点跟随其他物体（比如角色的手）
