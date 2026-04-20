# Step 06：完整代码与调参指南

## 1. 最终完整代码

这是 `LightningController.ts` 的完整最终版本，包含所有功能：

```typescript
import { _decorator, Component, Graphics, Color, Node, Vec2, Vec3 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('LightningController')
@executeInEditMode
export class LightningController extends Component {

    // ==================== Inspector 参数 ====================

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

    @property({ tooltip: '闪电核心颜色（建议白色或浅蓝色）' })
    coreColor: Color = new Color(220, 230, 255, 255);

    @property({ tooltip: '闪电辉光颜色（建议半透明蓝紫色）' })
    glowColor: Color = new Color(100, 150, 255, 80);

    @property({ range: [1, 6, 0.5], slide: true, tooltip: '核心线宽' })
    coreWidth: number = 2;

    @property({ range: [4, 30, 1], slide: true, tooltip: '辉光线宽' })
    glowWidth: number = 12;

    @property({ range: [0.02, 0.3, 0.01], slide: true, tooltip: '闪烁间隔（秒），越小闪得越快' })
    flashInterval: number = 0.05;

    @property({ range: [0, 100, 0.1], slide: true, tooltip: '持续时间（秒），0 = 无限' })
    duration: number = 0;

    @property({ tooltip: '运行后自动开始闪电' })
    autoStart: boolean = true;

    // ==================== 内部数据 ====================

    private _graphics: Graphics | null = null;
    private _bolts: Vec2[][] = [];
    private _flashTimer: number = 0;
    private _durationTimer: number = 0;
    private _isActive: boolean = false;
    private _tempVec3: Vec3 = new Vec3();

    // ==================== 生命周期 ====================

    onLoad() {
        this._graphics = this.getComponent(Graphics);
    }

    start() {
        if (this.autoStart && this.endNode) {
            this.startLightning();
        }
    }

    update(dt: number) {
        if (!this._isActive) return;

        this._flashTimer += dt;
        if (this._flashTimer >= this.flashInterval) {
            this._flashTimer = 0;
            this._regenerateBolts();
            this._drawBolts();
        }

        if (this.duration > 0) {
            this._durationTimer += dt;
            if (this._durationTimer >= this.duration) {
                this.stopLightning();
            }
        }
    }

    // ==================== 公开接口 ====================

    public startLightning() {
        this._isActive = true;
        this._flashTimer = this.flashInterval;
        this._durationTimer = 0;
    }

    public stopLightning() {
        this._isActive = false;
        this._bolts = [];
        if (this._graphics) {
            this._graphics.clear();
        }
    }

    // ==================== 坐标转换 ====================

    private _getLocalPos(targetNode: Node): Vec2 {
        const worldPos = targetNode.worldPosition;
        this.node.inverseTransformPoint(this._tempVec3, worldPos);
        return new Vec2(this._tempVec3.x, this._tempVec3.y);
    }

    // ==================== 闪电生成 ====================

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

    // ==================== 绘制 ====================

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

## 2. 调参指南

### 推荐预设

#### 自然闪电（默认）

```
subdivision: 5
chaosFactor: 0.15
boltCount: 2
coreColor: (220, 230, 255, 255)
glowColor: (100, 150, 255, 80)
coreWidth: 2
glowWidth: 12
flashInterval: 0.05
```

#### 电击/电弧（短距离，高能量感）

```
subdivision: 4
chaosFactor: 0.25
boltCount: 3
coreColor: (255, 255, 255, 255)
glowColor: (180, 200, 255, 120)
coreWidth: 3
glowWidth: 18
flashInterval: 0.03
```

#### 温和电流（长距离，低能量感）

```
subdivision: 6
chaosFactor: 0.08
boltCount: 1
coreColor: (200, 220, 255, 200)
glowColor: (80, 120, 200, 40)
coreWidth: 1.5
glowWidth: 8
flashInterval: 0.08
```

#### 红色魔法闪电

```
subdivision: 5
chaosFactor: 0.2
boltCount: 3
coreColor: (255, 200, 200, 255)
glowColor: (255, 50, 50, 60)
coreWidth: 2
glowWidth: 15
flashInterval: 0.04
```

#### 绿色毒液电弧

```
subdivision: 4
chaosFactor: 0.3
boltCount: 2
coreColor: (200, 255, 200, 255)
glowColor: (50, 200, 50, 80)
coreWidth: 2.5
glowWidth: 14
flashInterval: 0.06
```

### 参数效果速查表

```
参数                效果
─────────────────────────────────────────────
subdivision ↑      闪电更精细，线段更多
subdivision ↓      闪电粗犷，线段少

chaosFactor ↑      弯曲剧烈，更狂野
chaosFactor ↓      接近直线，更温和

boltCount ↑        看起来更粗壮（多条叠加）
boltCount ↓        看起来更细（单条）

coreWidth ↑        核心线更粗
glowWidth ↑        辉光范围更大

glowColor.alpha ↑  辉光更亮
glowColor.alpha ↓  辉光更淡

flashInterval ↑    闪烁慢，像慢动作
flashInterval ↓    闪烁快，更有活力
```

## 3. 性能注意事项

### 每帧开销分析

```
每帧执行的操作（当 flashTimer 触发时）：
1. _regenerateBolts：生成 boltCount 条闪电
   - 每条闪电：subdivision 轮循环
   - 每轮线段数翻倍
   - 最终点数 = boltCount × (2^subdivision + 1)

2. _drawBolts：绘制所有闪电
   - 每条闪电画 2 次（辉光 + 核心）
   - 每次 moveTo + N 个 lineTo + stroke

开销主要来自：
- 数组分配：每帧创建新的 Seg[] 和 Vec2[]
- Graphics drawcall：每次 stroke() = 一个 drawcall
```

### 性能建议

```
1. subdivision 不要超过 7
   - 7 = 128 段 × boltCount 条 = 已经足够精细
   - 8 = 256 段，收益递减，开销翻倍

2. boltCount 不要超过 5
   - 5 条 × 2 层（辉光+核心）= 10 次 stroke
   - 每次 stroke 都是一个 drawcall

3. flashInterval 不要低于 0.02
   - 0.02 秒 = 50 FPS
   - 再低人眼也分辨不出差异，纯浪费

4. 不需要闪电时调用 stopLightning()
   - _isActive = false → update 立即 return
   - 零开销
```

### 与 Unity 版的性能对比

```
Unity 版：
- LineRenderer 是 GPU 渲染管线
- 材质纹理切换几乎零开销
- 适合大量闪电

Cocos 版（Graphics）：
- CPU 软件绘制
- 每次 stroke 有一定开销
- 适合同屏少量闪电（5 条以内性能良好）

如果需要大量闪电，考虑改用 Mesh 或 Shader 方案。
但对于大多数 2D 游戏场景，Graphics 方案足够。
```

## 4. 使用场景示例

### 角色技能闪电链

```typescript
// 在技能脚本中
const lightning = this.lightningNode.getComponent(LightningController);
lightning.startNode = this.casterNode;    // 施法者
lightning.endNode = this.targetNode;       // 目标
lightning.duration = 0.5;                  // 持续 0.5 秒
lightning.startLightning();
```

### 场景装饰电弧

```
节点树：
Tesla (Node)
├── LightningController
├── Graphics
├── TopPoint    (y: 100)
└── BottomPoint (y: -100)

设置：
autoStart: true
duration: 0
flashInterval: 0.06
boltCount: 2

→ 一个永远在放电的特斯拉线圈装饰
```

### 多段连续闪电

```
如果需要 A→B→C→D 的多段闪电：

Lightning1: A → B
Lightning2: B → C
Lightning3: C → D

每个节点挂一个 LightningController
三个同时 startLightning()
→ 看起来像一道连续的闪电链
```

## 5. 完整节点结构回顾

```
Canvas
└── Lightning                    ← 空节点
    ├── [UITransform]            ← 自动添加
    ├── [Graphics]               ← 手动添加：画线组件
    ├── [LightningController]    ← 手动添加：闪电脚本
    │     ├── Start Node → StartPoint
    │     ├── End Node → EndPoint
    │     ├── subdivision: 5
    │     ├── chaosFactor: 0.15
    │     ├── boltCount: 2
    │     └── ...
    ├── StartPoint               ← 空子节点（起点位置）
    └── EndPoint                 ← 空子节点（终点位置）
```

## 6. 最终验收标准

- [ ] 闪电从 StartPoint 到 EndPoint 正确渲染
- [ ] 闪电路径随机生成，每次闪烁不同
- [ ] 有辉光效果（宽线 + 窄线两层）
- [ ] 定时闪烁，频率可调
- [ ] `startLightning()` / `stopLightning()` 工作正常
- [ ] `duration > 0` 时自动停止
- [ ] `autoStart` 控制是否自动启动
- [ ] 拖动 StartPoint / EndPoint 节点位置，闪电跟随变化
- [ ] 各项参数在 Inspector 中可调且效果正确
- [ ] 代码总行数约 160 行，无多余抽象

> **恭喜完成！** 你已经用 ~160 行 TypeScript 实现了一个完整的 2D 动态闪电效果。
> 核心就是一个中点位移算法 + Graphics 画线 + 定时器刷新。
> 没有 Shader，没有预制体，没有第三方库。简洁就是力量。
