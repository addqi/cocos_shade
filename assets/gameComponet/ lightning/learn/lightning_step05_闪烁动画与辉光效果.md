# Step 05：闪烁动画与辉光效果

## 1. 需求是什么

静态闪电不像真的闪电。真正的闪电在**不断闪烁**——路径每一瞬间都在变化。

秘密很简单：**每隔一小段时间重新生成一次闪电路径**。因为每次随机结果不同，视觉上就是在"闪烁"。

```
帧 1: 生成路径 A → 画出来
      A ──╱╲──╱──╲──
等 0.05 秒...
帧 2: 生成路径 B（和 A 完全不同）→ 画出来
      B ──╲──╱╲──╱──
等 0.05 秒...
帧 3: 生成路径 C → 画出来
      C ──╱──╲╱──╲──

人眼看到 A→B→C 快速切换 = "闪烁"
```

### 这一步做什么

```
✅ update() 中加入计时器，定时重新生成并绘制
✅ startLightning() / stopLightning() 公开接口
✅ duration 持续时间控制
✅ autoStart 自动开始

❌ 之前所有功能不变，只是加上了"动起来"的逻辑
```

## 2. 具体完整代码

在 Step 04 基础上，修改 `start()`、`update()`，添加 `startLightning()`、`stopLightning()`。

### 修改 start 方法

```typescript
start() {
    if (this.autoStart && this.endNode) {
        this.startLightning();
    }
}
```

### 添加 startLightning / stopLightning

```typescript
/**
 * 开始闪电效果。
 * 外部调用此方法来触发闪电。
 */
public startLightning() {
    this._isActive = true;
    // 将计时器设为 flashInterval，这样 update 第一帧就立即触发
    this._flashTimer = this.flashInterval;
    this._durationTimer = 0;
}

/**
 * 停止闪电效果，清除画面。
 */
public stopLightning() {
    this._isActive = false;
    this._bolts = [];
    if (this._graphics) {
        this._graphics.clear();
    }
}
```

### 修改 update 方法

```typescript
update(dt: number) {
    if (!this._isActive) return;

    // 计时器累加
    this._flashTimer += dt;

    // 到达闪烁间隔 → 重新生成 + 重新绘制
    if (this._flashTimer >= this.flashInterval) {
        this._flashTimer = 0;
        this._regenerateBolts();
        this._drawBolts();
    }

    // 持续时间检查（duration > 0 时生效）
    if (this.duration > 0) {
        this._durationTimer += dt;
        if (this._durationTimer >= this.duration) {
            this.stopLightning();
        }
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

    @property({ range: [0.02, 0.3, 0.01], slide: true, tooltip: '闪烁间隔（秒），越小闪得越快' })
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

    // ★ 修改：使用 autoStart 控制
    start() {
        if (this.autoStart && this.endNode) {
            this.startLightning();
        }
    }

    // ★ 修改：加入计时器逻辑
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

    // ★ 新增：公开接口
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

## 关键概念解读

### 计时器模式 vs Unity Coroutine

```
Unity 版用协程：
  IEnumerator TriggerMultLightning() {
      while (timer < multDuration) {
          GenerateLightning(...);
          yield return new WaitForSeconds(onceDuration);
      }
  }

Cocos 版用计时器：
  update(dt) {
      this._flashTimer += dt;
      if (this._flashTimer >= this.flashInterval) {
          this._flashTimer = 0;
          this._regenerateBolts();
          this._drawBolts();
      }
  }

两种方式效果相同，但计时器有几个优势：
1. 没有协程的隐式状态，逻辑更透明
2. 容易暂停/恢复（设 _isActive = false）
3. 不需要 StopAllCoroutines() 来清理
```

### 为什么 `_flashTimer` 初始值设为 `flashInterval`？

```
startLightning() {
    this._flashTimer = this.flashInterval;  // 关键！
}

如果设为 0：
  → update 第一帧 flashTimer += dt（约 0.016）
  → 0.016 < 0.05 → 不满足条件 → 不生成不绘制
  → 要等 3 帧才看到第一道闪电

设为 flashInterval：
  → update 第一帧 flashTimer += dt
  → flashInterval + 0.016 >= flashInterval → 立即触发！
  → 第一帧就能看到闪电

这是个小技巧：让效果立即响应，而不是"迟钝"地等一个间隔。
```

### 为什么 stopLightning 要 clear？

```
stopLightning() {
    this._isActive = false;   // 停止 update 逻辑
    this._bolts = [];          // 清空数据
    this._graphics.clear();    // 清空画面 ← 这行很重要！

如果不 clear()：
  → 最后一帧画的闪电会一直留在屏幕上
  → 因为没有 update 去重绘/清除它
  → 看起来闪电"冻住了"
```

### 与 Unity 版动画模式的对比

```
Unity 版有 4 种动画模式：
- None: 固定第一个纹理
- Random: 随机选纹理
- Loop: 循环遍历纹理
- PingPong: 来回遍历纹理

这些模式本质是在切换 Material 的 TextureOffset。

Cocos 版不需要纹理切换——
我们每帧重新生成路径，本身就产生了随机效果。
如果需要更多变化，可以在 _drawBolts 中随机调整颜色/线宽。

简单就是美。
```

## 3. 验收标准

- [ ] `startLightning()` 和 `stopLightning()` 方法已添加
- [ ] `update()` 中有计时器逻辑
- [ ] **运行后闪电会闪烁**：
  - [ ] 路径每 0.05 秒变化一次
  - [ ] 看起来像真正在放电
  - [ ] 多条闪电同时闪烁
- [ ] 动画参数测试：
  - [ ] `flashInterval` 调小 → 闪烁更快
  - [ ] `flashInterval` 调大 → 闪烁变慢
  - [ ] `duration` 设为 2 → 闪电 2 秒后自动停止
  - [ ] `duration` 设为 0 → 无限持续
  - [ ] `autoStart` 取消勾选 → 运行后不自动开始
- [ ] 外部调用测试：
  - [ ] 另一个脚本中调用 `lightningCtrl.startLightning()` 可启动
  - [ ] 调用 `lightningCtrl.stopLightning()` 可停止并清除画面

> **闪电动起来了！** 至此核心效果已完成。下一步汇总完整代码并给出调参手册。

> **小白常见问题**：
> - Q: 闪电闪烁太快/太慢？ → 调整 `flashInterval`，0.03 = 很快，0.1 = 较慢
> - Q: 想让闪电更粗更亮？ → 增大 `boltCount`（多条叠加）+ 增大 `glowWidth`
> - Q: 想让闪电跟随移动的物体？ → 把 `endNode` 设为那个物体。因为每帧都重新读坐标，自动跟随
> - Q: 怎么在代码中触发？ → `this.node.getComponent(LightningController).startLightning()`
