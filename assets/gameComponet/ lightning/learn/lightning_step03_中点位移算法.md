# Step 03：中点位移算法——闪电的灵魂

## 1. 需求是什么

这一步实现闪电效果的**核心算法**：中点位移（Midpoint Displacement）。

把一条直线变成一条锯齿闪电路径，所有的"随机感"都来自这个算法。

### 算法图解

```
输入：起点 A，终点 B，递归 3 次

═══════ 第 0 轮（1 条线段）═══════

A ─────────────────────── B

═══════ 第 1 轮（2 条线段）═══════

取 AB 中点 M，沿垂直方向偏移 → M'

A ──────── M' ──────── B
              ↑
          偏移量 = 距离 × chaosFactor

═══════ 第 2 轮（4 条线段）═══════

对 A→M' 和 M'→B 各取中点偏移

A ─── P ─── M' ─── Q ─── B
       ↑              ↑
   偏移量减半      偏移量减半

═══════ 第 3 轮（8 条线段）═══════

A ─ · ─ P ─ · ─ M' ─ · ─ Q ─ · ─ B

每轮偏移减半 → 大尺度粗糙 + 小尺度精细 = 分形特征
```

### 这一步做什么

```
✅ _generateBolt() 方法：中点位移算法
✅ _regenerateBolts() 方法：生成多条闪电
✅ 理解 2D 垂直方向计算

❌ 绘制（Step 04）
❌ 动画（Step 05）
```

## 2. 具体完整代码

在 Step 02 的基础上，添加 `_regenerateBolts()` 和 `_generateBolt()` 两个方法。

### 添加 _regenerateBolts 方法

```typescript
/**
 * 重新生成所有闪电路径。
 * 每次调用都产生全新的随机路径 → 连续调用就形成"闪烁"效果。
 */
private _regenerateBolts() {
    const startN = this.startNode || this.node;
    if (!this.endNode) return;

    const start = this._getLocalPos(startN);
    const end = this._getLocalPos(this.endNode);

    this._bolts = [];
    for (let b = 0; b < this.boltCount; b++) {
        this._bolts.push(this._generateBolt(start, end));
    }
}
```

### 添加 _generateBolt 方法（核心算法）

```typescript
/**
 * 中点位移算法。
 * 递归地将线段一分为二，沿垂直方向随机偏移中点。
 * 每轮偏移量减半，产生自然的分形锯齿。
 */
private _generateBolt(start: Vec2, end: Vec2): Vec2[] {
    type Seg = { s: Vec2; e: Vec2 };
    let segs: Seg[] = [{ s: start, e: end }];
    let offset = Vec2.distance(start, end) * this.chaosFactor;

    for (let iter = 0; iter < this.subdivision; iter++) {
        const next: Seg[] = [];

        for (const seg of segs) {
            // 1. 取中点
            const mid = new Vec2(
                (seg.s.x + seg.e.x) * 0.5,
                (seg.s.y + seg.e.y) * 0.5
            );

            // 2. 计算垂直方向并偏移
            const dx = seg.e.x - seg.s.x;
            const dy = seg.e.y - seg.s.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            if (len > 0.001) {
                // 2D 垂直方向：(dx, dy) → (-dy, dx)
                const d = (Math.random() - 0.5) * 2 * offset;
                mid.x += (-dy / len) * d;
                mid.y += (dx / len) * d;
            }

            // 3. 一条变两条
            next.push({ s: seg.s, e: mid });
            next.push({ s: mid, e: seg.e });
        }

        segs = next;
        offset *= 0.5;  // 每轮偏移减半
    }

    // 4. 提取有序点列表
    const points: Vec2[] = [segs[0].s];
    for (const seg of segs) {
        points.push(seg.e);
    }
    return points;
}
```

### 添加临时测试（在 start 中验证）

```typescript
start() {
    // ★ 临时测试：生成一条闪电并打印点数
    if (this.endNode) {
        const startN = this.startNode || this.node;
        const start = this._getLocalPos(startN);
        const end = this._getLocalPos(this.endNode);
        const bolt = this._generateBolt(start, end);
        console.log(`闪电生成成功！subdivision=${this.subdivision}，点数=${bolt.length}（应为 ${Math.pow(2, this.subdivision) + 1}）`);
    }
}
```

### 此步骤的完整代码

```typescript
import { _decorator, Component, Graphics, Color, Node, Vec2, Vec3 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('LightningController')
@executeInEditMode
export class LightningController extends Component {

    @property({ type: Node, tooltip: '闪电起点节点（不设置则使用自身位置）' })
    startNode: Node | null = null;

    @property({ type: Node, tooltip: '闪电终点节点' })
    endNode: Node | null = null;

    @property({ range: [1, 8, 1], slide: true, tooltip: '分段递归次数，每 +1 线段数翻倍' })
    subdivision: number = 5;

    @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '混乱系数，越大闪电弯曲越剧烈' })
    chaosFactor: number = 0.15;

    @property({ range: [1, 5, 1], slide: true, tooltip: '同时绘制的闪电条数' })
    boltCount: number = 2;

    @property({ tooltip: '闪电核心颜色' })
    coreColor: Color = new Color(220, 230, 255, 255);

    @property({ tooltip: '闪电辉光颜色' })
    glowColor: Color = new Color(100, 150, 255, 80);

    @property({ range: [1, 6, 0.5], slide: true, tooltip: '核心线宽' })
    coreWidth: number = 2;

    @property({ range: [4, 30, 1], slide: true, tooltip: '辉光线宽' })
    glowWidth: number = 12;

    @property({ range: [0.02, 0.3, 0.01], slide: true, tooltip: '闪烁间隔（秒）' })
    flashInterval: number = 0.05;

    @property({ range: [0, 100, 0.1], slide: true, tooltip: '持续时间（秒），0 = 无限' })
    duration: number = 0;

    @property({ tooltip: '运行后自动开始闪电' })
    autoStart: boolean = true;

    private _graphics: Graphics | null = null;
    private _bolts: Vec2[][] = [];
    private _flashTimer: number = 0;
    private _durationTimer: number = 0;
    private _isActive: boolean = false;
    private _tempVec3: Vec3 = new Vec3();

    onLoad() {
        this._graphics = this.getComponent(Graphics);
    }

    start() {
        // ★ 临时测试：验证算法输出
        if (this.endNode) {
            const startN = this.startNode || this.node;
            const s = this._getLocalPos(startN);
            const e = this._getLocalPos(this.endNode);
            const bolt = this._generateBolt(s, e);
            console.log(`闪电点数: ${bolt.length}，期望: ${Math.pow(2, this.subdivision) + 1}`);
        }
    }

    private _getLocalPos(targetNode: Node): Vec2 {
        const worldPos = targetNode.worldPosition;
        this.node.inverseTransformPoint(this._tempVec3, worldPos);
        return new Vec2(this._tempVec3.x, this._tempVec3.y);
    }

    // ★ 新增
    private _regenerateBolts() {
        const startN = this.startNode || this.node;
        if (!this.endNode) return;
        const start = this._getLocalPos(startN);
        const end = this._getLocalPos(this.endNode);

        this._bolts = [];
        for (let b = 0; b < this.boltCount; b++) {
            this._bolts.push(this._generateBolt(start, end));
        }
    }

    // ★ 新增：核心算法
    private _generateBolt(start: Vec2, end: Vec2): Vec2[] {
        type Seg = { s: Vec2; e: Vec2 };
        let segs: Seg[] = [{ s: start, e: end }];
        let offset = Vec2.distance(start, end) * this.chaosFactor;

        for (let iter = 0; iter < this.subdivision; iter++) {
            const next: Seg[] = [];
            for (const seg of segs) {
                const mid = new Vec2(
                    (seg.s.x + seg.e.x) * 0.5,
                    (seg.s.y + seg.e.y) * 0.5
                );
                const dx = seg.e.x - seg.s.x;
                const dy = seg.e.y - seg.s.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0.001) {
                    const d = (Math.random() - 0.5) * 2 * offset;
                    mid.x += (-dy / len) * d;
                    mid.y += (dx / len) * d;
                }
                next.push({ s: seg.s, e: mid });
                next.push({ s: mid, e: seg.e });
            }
            segs = next;
            offset *= 0.5;
        }

        const points: Vec2[] = [segs[0].s];
        for (const seg of segs) {
            points.push(seg.e);
        }
        return points;
    }
}
```

## 关键概念解读

### 为什么用 `type Seg` 而不是元组 `[Vec2, Vec2]`？

```
Unity 版用 (Vector3, Vector3) 元组 → 要用 .Item1 .Item2 访问
Cocos 版用 { s, e } 对象 → 用 seg.s seg.e 访问

seg.s 比 seg[0] 更清晰
这就是好品味：让代码自己说话
```

### `(Math.random() - 0.5) * 2` 是什么意思？

```
Math.random() 返回 [0, 1) 范围
- 0.5  → 变成 [-0.5, 0.5)
× 2    → 变成 [-1, 1)

再乘以 offset → 偏移范围 [-offset, +offset)

这样中点既可能向左偏，也可能向右偏
```

### 为什么每轮 `offset *= 0.5`？

```
不减半：每层偏移一样大 → 闪电像锯齿波，不自然
减半后：大尺度偏移大，小尺度偏移小 → 分形，像真实闪电

这和自然界的闪电分形结构一致：
主干偏移大，分支偏移小，末梢几乎是直线
```

### 点的提取为什么这么写？

```
线段列表：[{s:A, e:M}, {s:M, e:P}, {s:P, e:Q}, {s:Q, e:B}]

提取：先取第一个的 s（即 A），然后依次取每个的 e
结果：[A, M, P, Q, B]

这样不会漏点，也不会重复
```

### 与 Unity 版的对比

```
Unity 版：
  segmentList.Add((startPoint, middlePoint));
  segmentList.Add((middlePoint, endPoint));
  // 最后 RemoveRange 移除旧数据

Cocos 版：
  next.push({ s: seg.s, e: mid });
  next.push({ s: mid, e: seg.e });
  // 直接创建新数组，旧数据自动被 GC

Unity 版在原数组上追加 + 删除，Cocos 版每轮创建新数组。
两种方式性能差异可忽略，但 Cocos 版的逻辑更清晰——
不需要 startIndex/previousIndex 这种复杂的索引管理。
```

## 3. 验收标准

- [ ] `_generateBolt()` 方法已实现
- [ ] `_regenerateBolts()` 方法已实现
- [ ] 运行后控制台输出：
  - [ ] `subdivision=5` 时点数为 33（2^5 + 1）
  - [ ] `subdivision=3` 时点数为 9（2^3 + 1）
- [ ] 改变 `subdivision` 值，点数按 2^N + 1 变化

> **注意**：此时还看不到闪电——下一步用 Graphics 把它画出来！
> **测试完记得把 start() 中的临时测试代码删掉或注释掉。**

> **小白常见问题**：
> - Q: `Vec2.distance` 是什么？ → 计算两个 Vec2 之间的距离（勾股定理）
> - Q: 为什么要判断 `len > 0.001`？ → 避免除以零。如果起点终点重合，方向向量长度为 0
> - Q: `type Seg` 声明在函数内部，这样行吗？ → TypeScript 允许函数内部声明类型，只在该函数内有效
