# Step 04：用 Graphics 组件绘制闪电

## 1. 需求是什么

算法已经就位，现在把闪电**画出来**。

在 Cocos Creator 中，`Graphics` 组件就是 2D 矢量画笔。我们用 `moveTo` + `lineTo` + `stroke` 把点序列画成线条。

### 绘制流程

```
一条闪电的点序列：[P0, P1, P2, P3, ..., Pn]

绘制步骤：
1. moveTo(P0)    → 提笔移到起点
2. lineTo(P1)    → 画线到第 1 个点
3. lineTo(P2)    → 画线到第 2 个点
   ...
n. lineTo(Pn)    → 画线到终点
n+1. stroke()    → 描边，线条显示出来

就这么简单。Graphics 的 lineTo 连续调用就形成折线。
```

### 这一步做什么

```
✅ _drawBolts() 方法：绘制所有闪电
✅ _strokePath() 辅助方法：画一条折线路径
✅ update() + start() 驱动绘制
✅ 首次看到静态闪电！

❌ 辉光效果（Step 05 完善）
❌ 闪烁动画（Step 05）
```

## 2. 具体完整代码

在 Step 03 的基础上，添加 `_drawBolts()`、`_strokePath()`，修改 `start()` 和 `update()`。

### 添加 _strokePath 方法

```typescript
/**
 * 用 Graphics 画一条折线路径。
 * 单一职责：只负责"画"，不关心"画什么"。
 */
private _strokePath(g: Graphics, points: Vec2[], color: Color, width: number) {
    g.strokeColor = color;
    g.lineWidth = width;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        g.lineTo(points[i].x, points[i].y);
    }
    g.stroke();
}
```

### 添加 _drawBolts 方法

```typescript
/**
 * 绘制所有闪电。
 * 每条闪电先画辉光层（宽+半透明），再画核心层（窄+不透明）。
 */
private _drawBolts() {
    const g = this._graphics;
    if (!g) return;
    g.clear();

    for (const bolt of this._bolts) {
        if (bolt.length < 2) continue;
        // 先画宽的辉光，再画窄的核心 → 核心叠在辉光上面
        this._strokePath(g, bolt, this.glowColor, this.glowWidth);
        this._strokePath(g, bolt, this.coreColor, this.coreWidth);
    }
}
```

### 修改 start 和 update

```typescript
start() {
    // 立即生成一次闪电并绘制（静态预览）
    this._regenerateBolts();
    this._drawBolts();
}

update(dt: number) {
    // 暂时空着，Step 05 加动画
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

    // ★ 修改：生成并绘制一次
    start() {
        this._regenerateBolts();
        this._drawBolts();
    }

    update(dt: number) {
        // Step 05 加动画逻辑
    }

    private _getLocalPos(targetNode: Node): Vec2 {
        const worldPos = targetNode.worldPosition;
        this.node.inverseTransformPoint(this._tempVec3, worldPos);
        return new Vec2(this._tempVec3.x, this._tempVec3.y);
    }

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

    // ==================== ★ 新增：绘制 ====================

    private _drawBolts() {
        const g = this._graphics;
        if (!g) return;
        g.clear();

        for (const bolt of this._bolts) {
            if (bolt.length < 2) continue;
            this._strokePath(g, bolt, this.glowColor, this.glowWidth);
            this._strokePath(g, bolt, this.coreColor, this.coreWidth);
        }
    }

    private _strokePath(g: Graphics, points: Vec2[], color: Color, width: number) {
        g.strokeColor = color;
        g.lineWidth = width;
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            g.lineTo(points[i].x, points[i].y);
        }
        g.stroke();
    }
}
```

## 关键 API 解读

### `g.clear()`

```
每帧必须先清除上一帧的绘制。
Graphics 不是 Sprite——它是手动画布，你画什么就显示什么。

帧 1: 画了闪电 A
帧 2: 不清除 → A + B 重叠 → 乱了
帧 2: 先 clear() → 只有 B → 正确
```

### `g.moveTo()` vs `g.lineTo()`

```
moveTo = "提起笔，移到这个位置"（不画线）
lineTo = "从当前位置画一条线到目标位置"

moveTo(P0) → lineTo(P1) → lineTo(P2) → lineTo(P3)
结果：P0──P1──P2──P3 的折线
```

### `g.stroke()` vs `g.fill()`

```
stroke() = 描边（画线条轮廓）
fill()   = 填充（闭合区域涂色）

闪电是线条，所以只用 stroke
水面是多边形，所以用 fill + stroke
```

### 为什么先画辉光再画核心？

```
绘制顺序决定了层级（后画的在上面）：

第 1 层：辉光（宽 12px，半透明蓝色）
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

第 2 层：核心（宽 2px，不透明白色）
            ████████████

合在一起 → 白色核心外围有蓝色光晕
  ▓▓▓▓▓▓▓▓████████████▓▓▓▓▓▓▓▓
```

### 与 Unity 版绘制方式的对比

```
Unity 版：
  lineRenderer.positionCount = segmentList.Count + 1;
  lineRenderer.SetPosition(0, startPoint);
  for (i) lineRenderer.SetPosition(i+1, endPoint);
  → 设置 LineRenderer 的顶点数组

Cocos 版：
  g.moveTo(points[0]);
  for (i) g.lineTo(points[i]);
  g.stroke();
  → 手动画线

Unity 的 LineRenderer 可以用纹理/材质做效果
Cocos 的 Graphics 更灵活——可以画任意形状
我们用多层绘制（辉光+核心）来模拟 Unity 的材质效果
```

## 3. 验收标准

- [ ] `_strokePath()` 方法已添加
- [ ] `_drawBolts()` 方法已添加
- [ ] `start()` 中调用了 `_regenerateBolts()` + `_drawBolts()`
- [ ] **运行后能看到闪电**：
  - [ ] 从 StartPoint 到 EndPoint 有一条（或多条）锯齿线
  - [ ] 线条有蓝色辉光和白色核心（两层）
  - [ ] 闪电路径是随机的（每次运行不同）
- [ ] 调参测试：
  - [ ] `subdivision` 增大 → 闪电更精细
  - [ ] `chaosFactor` 增大 → 闪电更弯曲
  - [ ] `boltCount` 增大 → 同时显示更多条
  - [ ] `coreWidth` / `glowWidth` 调大 → 线条变粗
  - [ ] 修改 `coreColor` / `glowColor` → 颜色变化

> **首次看到闪电了！** 虽然还是静止的一帧，但下一步加上定时器它就会闪烁起来。

> **小白常见问题**：
> - Q: 运行后什么都看不到？ → 检查 `endNode` 是否已拖入 Inspector
> - Q: 看到了但没有辉光？ → 检查 `glowColor` 的 Alpha 值，0 = 完全透明
> - Q: 线条太细看不清？ → 把 `coreWidth` 调到 3~4，`glowWidth` 调到 15~20
> - Q: 只有一条直线没有锯齿？ → 检查 `subdivision` 是否 > 0，`chaosFactor` 是否 > 0
