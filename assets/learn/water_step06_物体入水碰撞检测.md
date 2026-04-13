# Step 06：物体入水交互 - 碰撞检测

## 1. 需求是什么

水面物理完成了，但还需要手动调用 `splash()` 才能触发波浪。这一步实现：**物体掉进水里自动产生波浪**。

### Cocos Creator 2D 物理碰撞方案

在 Cocos 中实现碰撞检测，需要给水面加一个"触发区域"：

```
                       🪨 Ball（Dynamic RigidBody2D + CircleCollider2D）
                        ↓ 自由落体
                        ↓
  ┌─────────────────────────────────────────┐
  │    BoxCollider2D (sensor = true)        │ ← 水面触发区域
  │    覆盖整个水面宽度，高度很薄            │
  └─────────────────────────────────────────┘
  ┌─────────────────────────────────────────┐
  │                                         │
  │              水体区域                    │
  │                                         │
  └─────────────────────────────────────────┘
```

当 Ball 触碰到这个薄薄的触发区域时：
1. 触发 `BEGIN_CONTACT` 事件
2. 获取 Ball 的速度和 X 坐标
3. 根据 X 坐标找到最近的弹簧
4. 把速度施加到那个弹簧上

### sensor 是什么？

```
普通 Collider（sensor = false）：
  物体碰到会被挡住（像一堵墙）

Sensor Collider（sensor = true）：
  物体可以穿过，但会触发碰撞事件（像一道光幕检测门）

我们的水面需要 sensor，因为物体应该能"掉进水里"，而不是被弹开。
```

### 这一步做什么

```
✅ 给 Water 节点添加 RigidBody2D (Static) + BoxCollider2D (sensor)
✅ 监听 BEGIN_CONTACT 碰撞事件
✅ 根据碰撞点 X 坐标找到最近的弹簧
✅ 把碰撞物体的速度施加到弹簧上
```

## 2. 具体完整代码

### 2.1 场景配置

先在编辑器中给节点添加组件：

**Water 节点**需要添加：
1. **RigidBody2D** → Type 选 **Static**（水不动）
2. **BoxCollider2D** → 勾选 **Sensor**（不阻挡物体）
   - 设置 `Size`：X = waterWidth，Y = 约 20~30（薄薄一层覆盖水面）
   - 设置 `Offset`：X = 0，Y = waterHeight / 2（顶部对齐水面线）

**Ball 节点**需要（Step 01 已创建）：
1. **RigidBody2D** → Type 选 **Dynamic**
2. **CircleCollider2D** → 调整 Radius

### 2.2 修改 WaterController.ts

需要新增：import 物理相关模块、碰撞回调注册、碰撞处理逻辑。

```typescript
import {
    _decorator, Component, Graphics, Color, UITransform,
    RigidBody2D, Collider2D, Contact2DType, IPhysics2DContact, Vec2
} from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('WaterController')
@executeInEditMode
export class WaterController extends Component {

    // ==================== Inspector 参数 ====================
    @property({ tooltip: '水面宽度（像素）' })
    waterWidth: number = 800;

    @property({ tooltip: '水面高度（像素）' })
    waterHeight: number = 300;

    @property({ range: [3, 100, 1], slide: true, tooltip: '弹簧点数量' })
    springCount: number = 20;

    @property({ range: [0.01, 1, 0.01], slide: true, tooltip: '弹性系数' })
    springStiffness: number = 0.1;

    @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '阻尼系数' })
    dampening: number = 0.03;

    @property({ range: [0.001, 0.1, 0.001], slide: true, tooltip: '传播系数' })
    spread: number = 0.006;

    @property({ tooltip: '水面线条颜色' })
    surfaceColor: Color = new Color(100, 180, 255, 255);

    @property({ tooltip: '水体填充颜色' })
    bodyColor: Color = new Color(30, 80, 180, 180);

    @property({ range: [1, 10, 1], tooltip: '水面线条粗细' })
    lineWidth: number = 4;

    @property({ range: [1, 200, 1], tooltip: '入水速度衰减系数（越大波浪越小）' })
    splashDamping: number = 50;

    @property({ range: [1, 20, 1], tooltip: '最大波浪速度限制' })
    maxSplashVelocity: number = 8;

    // ==================== 内部数据 ====================
    private _graphics: Graphics | null = null;
    private _heights: number[] = [];
    private _velocities: number[] = [];
    private _springSpacing: number = 0;
    private _surfaceY: number = 0;
    private _bottomY: number = 0;
    private _leftX: number = 0;

    // ==================== 生命周期 ====================

    onLoad() {
        this._graphics = this.getComponent(Graphics);
        this._initSprings();
        this._registerCollision(); // ★ 注册碰撞
    }

    onDestroy() {
        this._unregisterCollision(); // ★ 注销碰撞
    }

    update(dt: number) {
        this._updateSprings();
        this._propagateWaves();
        this._drawWater();
    }

    // ==================== 初始化 ====================

    private _initSprings() {
        this._leftX = -this.waterWidth / 2;
        this._surfaceY = this.waterHeight / 2;
        this._bottomY = -this.waterHeight / 2;
        this._springSpacing = this.waterWidth / (this.springCount + 1);
        this._heights = new Array(this.springCount).fill(0);
        this._velocities = new Array(this.springCount).fill(0);

        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(this.waterWidth, this.waterHeight);
        }
    }

    private _getSpringX(i: number): number {
        return this._leftX + (i + 1) * this._springSpacing;
    }

    private _getSpringY(i: number): number {
        return this._surfaceY + this._heights[i];
    }

    // ==================== ★ 碰撞检测 ====================

    /**
     * 注册碰撞事件监听。
     * 在 onLoad 中调用。
     */
    private _registerCollision() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    private _unregisterCollision() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
    }

    /**
     * 碰撞回调：当物体接触水面时触发。
     *
     * selfCollider = 水面的 Collider
     * otherCollider = 碰到水面的物体的 Collider
     */
    private _onBeginContact(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    ) {
        // 获取碰撞物体的刚体
        const otherBody = otherCollider.node.getComponent(RigidBody2D);
        if (!otherBody) return;

        // 获取碰撞物体的世界坐标
        const otherWorldPos = otherCollider.node.worldPosition;

        // 将世界坐标转换为水面的本地坐标
        const localPos = this.node.inverseTransformPoint(new Vec2(), otherWorldPos as any);

        // 根据 X 坐标找到最近的弹簧
        const springIndex = this._findNearestSpring(localPos.x);

        // 获取碰撞物体的速度
        const velocity = otherBody.linearVelocity;

        // 施加速度到弹簧（衰减 + 限制幅度）
        const clampedVel = Math.max(
            -this.maxSplashVelocity,
            Math.min(this.maxSplashVelocity, velocity.y / this.splashDamping)
        );

        this.splash(springIndex, clampedVel);
    }

    /**
     * 根据 X 坐标（本地空间）找到最近的弹簧索引。
     */
    private _findNearestSpring(localX: number): number {
        let minDist = Infinity;
        let nearest = 0;

        for (let i = 0; i < this.springCount; i++) {
            const dist = Math.abs(this._getSpringX(i) - localX);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        }

        return nearest;
    }

    // ==================== 公开接口 ====================

    public splash(index: number, velocity: number) {
        if (index >= 0 && index < this.springCount) {
            this._velocities[index] += velocity;
        }
    }

    // ==================== 物理更新 ====================

    private _updateSprings() {
        for (let i = 0; i < this.springCount; i++) {
            const springForce = -this.springStiffness * this._heights[i];
            const dampForce = -this.dampening * this._velocities[i];
            this._velocities[i] += springForce + dampForce;
            this._heights[i] += this._velocities[i];
        }
    }

    private _propagateWaves() {
        const count = this.springCount;
        const deltas = new Array(count).fill(0);

        for (let i = 0; i < count; i++) {
            if (i > 0) {
                deltas[i - 1] += this.spread * (this._heights[i] - this._heights[i - 1]);
            }
            if (i < count - 1) {
                deltas[i + 1] += this.spread * (this._heights[i] - this._heights[i + 1]);
            }
        }

        for (let i = 0; i < count; i++) {
            this._velocities[i] += deltas[i];
        }
    }

    // ==================== 绘制 ====================

    private _drawWater() {
        const g = this._graphics;
        if (!g) return;
        g.clear();

        const leftX = this._leftX;
        const rightX = -this._leftX;
        const surfaceY = this._surfaceY;
        const bottomY = this._bottomY;

        g.fillColor = this.bodyColor;
        g.moveTo(leftX, bottomY);
        g.lineTo(leftX, surfaceY);
        for (let i = 0; i < this.springCount; i++) {
            g.lineTo(this._getSpringX(i), this._getSpringY(i));
        }
        g.lineTo(rightX, surfaceY);
        g.lineTo(rightX, bottomY);
        g.close();
        g.fill();

        g.strokeColor = this.surfaceColor;
        g.lineWidth = this.lineWidth;
        g.moveTo(leftX, surfaceY);
        for (let i = 0; i < this.springCount; i++) {
            g.lineTo(this._getSpringX(i), this._getSpringY(i));
        }
        g.lineTo(rightX, surfaceY);
        g.stroke();
    }
}
```

### 碰撞检测流程图

```
Ball 掉落碰到 BoxCollider2D (sensor)
    ↓
_onBeginContact 触发
    ↓
获取 Ball 的世界位置 → 转为水面本地坐标
    ↓
_findNearestSpring(localX) → 找到最近的弹簧索引
    ↓
获取 Ball 的 linearVelocity.y
    ↓
velocity.y / splashDamping → 衰减（防止波浪太大）
    ↓
Math.max/min 限制在 ±maxSplashVelocity 范围内
    ↓
splash(index, clampedVel) → 波浪产生！
```

### 坐标转换为什么必要？

```
Ball 的位置是世界坐标（比如 x=300, y=500）
弹簧的 X 是 Water 节点的本地坐标（比如 x=-200 到 200）

如果 Water 节点不在原点（比如 worldPos = (100, 0)），
Ball 世界 X=300 → 在 Water 本地空间是 X=200

用 inverseTransformPoint 就能正确转换。
```

## 3. 验收标准

- [ ] Water 节点添加了 **RigidBody2D** (Static) 和 **BoxCollider2D** (Sensor)
- [ ] BoxCollider2D 的 Size 和 Offset 配置正确（覆盖水面线）
- [ ] Ball 节点有 **RigidBody2D** (Dynamic) 和 **CircleCollider2D**
- [ ] `_registerCollision()` / `_unregisterCollision()` 已添加
- [ ] `_onBeginContact()` 和 `_findNearestSpring()` 已添加
- [ ] `start()` 中的临时 splash 测试已删除
- [ ] **运行游戏**：
  - [ ] Ball 从上方掉落
  - [ ] Ball 碰到水面时产生波浪
  - [ ] 波浪从碰撞点向两边扩散
  - [ ] 波浪逐渐消散
- [ ] 从不同高度扔 Ball：
  - [ ] 高度越高 → 速度越快 → 波浪越大
  - [ ] 但波浪不超过 `maxSplashVelocity` 限制
- [ ] 从不同 X 位置扔 Ball：
  - [ ] 波浪在 Ball 碰到的位置产生（不总是在中间）

> **完整的交互式 2D 水面达成！**
> 物体掉进去 → 产生波浪 → 波浪扩散 → 恢复平静。
> 接下来是锦上添花：随机水花 + 自动流动。

> **小白常见问题**：
> - Q: Ball 掉下来但没波浪？ → 检查 BoxCollider2D 是否勾选了 **Sensor**
> - Q: 还是没波浪？ → 确认 Water 和 Ball 的 **Group** (碰撞分组) 设置允许碰撞
> - Q: 波浪太大/太小？ → 调整 `splashDamping` 和 `maxSplashVelocity`
> - Q: Ball 被水面弹开了？ → Sensor 没勾选，物体碰到实体 Collider 会被弹开
> - Q: Console 报 `Cannot read property of null`？ → 确认 Ball 上有 RigidBody2D
