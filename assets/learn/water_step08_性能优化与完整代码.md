# Step 08：性能优化与完整代码

## 1. 需求是什么

功能全部完成。这最后一步：
1. 了解代码中的**性能优化技巧**
2. 给出**完整最终代码**（直接能用）
3. 最终配置和常见问题排查

## 2. 性能优化详解

### 优化点 1：避免每帧 new Array

**问题**：`_propagateWaves()` 中每帧都 `new Array(count).fill(0)` → 创建新数组 → GC 压力。

```typescript
// ❌ 每帧创建新数组（GC 分配）
private _propagateWaves() {
    const deltas = new Array(count).fill(0); // 每帧 new 一个数组
    // ...
}

// ✅ 预分配数组，每帧清零复用
private _deltas: number[] = [];

private _initSprings() {
    // ...
    this._deltas = new Array(this.springCount).fill(0);
}

private _propagateWaves() {
    const deltas = this._deltas;
    deltas.fill(0); // 清零复用，不创建新对象
    // ...
}
```

**收益**：每帧少一次 GC 分配。60fps × 每帧一个数组 = 每秒 60 个临时对象被回收。

### 优化点 2：Graphics 重绘优化

**问题**：`_drawWater()` 每帧 `clear()` + 重绘所有路径。Graphics 底层需要重建顶点缓冲。

**优化方向**：
- 当水面完全平静时（所有 `heights` 接近 0、没有自动波浪），可以跳过重绘
- 添加一个"脏标记"，只在水面变化时才重绘

```typescript
private _isDirty: boolean = true;

// 在 splash、_updateSprings 等会改变水面状态的地方设置
this._isDirty = true;

private _drawWater() {
    if (!this._isDirty && !this.enableAutoWave) return;
    // ... 正常绘制 ...
    this._isDirty = false;
}
```

### 优化点 3：schedule vs update 做定时任务

```typescript
// ✅ 随机水花：用 schedule（低频定时任务）
this.schedule(this._randomSplash, 0.3);

// ✅ 物理更新：用 update（每帧必须执行）
update(dt) {
    this._updateSprings();
    // ...
}
```

`schedule` 不占 update 周期，由引擎底层调度，适合"隔几秒做一次"的任务。
`update` 每帧必调，适合物理/渲染等连续任务。

### 优化点 4：碰撞检测用 sensor 替代自定义检测

```typescript
// ❌ 每帧遍历所有物体检测碰撞（O(n) 每帧）
update(dt) {
    for (const body of allBodies) {
        if (body.y < waterSurface) { ... }
    }
}

// ✅ 用 sensor Collider + 碰撞事件（引擎优化的空间分区）
collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
```

Box2D 引擎内部用空间分区（broad phase），比手动遍历高效得多。

### Cocos 版 vs Unity 版的架构优势

| 方面 | Unity 版 | Cocos 版 | 谁赢 |
|------|----------|----------|------|
| 弹簧存储 | N 个 GameObject + Component | 2 个 number[] | Cocos（零 GC） |
| 渲染 | SpriteShape（引擎管理） | Graphics（代码控制） | 各有优劣 |
| 自动波浪 | ShaderGraph（GPU） | Math.sin（CPU） | Unity（GPU 更高效） |
| 碰撞检测 | N 个 BoxCollider2D | 1 个 BoxCollider2D | Cocos（更少碰撞体） |
| 代码量 | 2 个文件 ~200 行 | 1 个文件 ~200 行 | 持平 |

## 3. 完整最终代码

### WaterController.ts

```typescript
import {
    _decorator, Component, Graphics, Color, UITransform,
    RigidBody2D, Collider2D, Contact2DType, IPhysics2DContact, Vec2, Vec3
} from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('WaterController')
@executeInEditMode
export class WaterController extends Component {

    // ==================== 水面尺寸 ====================

    @property({ tooltip: '水面宽度（像素）' })
    waterWidth: number = 800;

    @property({ tooltip: '水面高度（像素）' })
    waterHeight: number = 300;

    // ==================== 弹簧物理 ====================

    @property({ range: [3, 100, 1], slide: true, tooltip: '弹簧点数量，越多水面越细腻' })
    springCount: number = 20;

    @property({ range: [0.01, 1, 0.01], slide: true, tooltip: '弹性系数：越大弹得越猛，水越"硬"' })
    springStiffness: number = 0.1;

    @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '阻尼系数：越大停得越快' })
    dampening: number = 0.03;

    @property({ range: [0.001, 0.1, 0.001], slide: true, tooltip: '传播系数：越大波浪传得越远' })
    spread: number = 0.006;

    // ==================== 碰撞参数 ====================

    @property({ range: [1, 200, 1], tooltip: '入水速度衰减系数（越大波浪越小）' })
    splashDamping: number = 50;

    @property({ range: [1, 20, 1], tooltip: '最大波浪速度限制' })
    maxSplashVelocity: number = 8;

    // ==================== 波浪效果 ====================

    @property({ tooltip: '开启随机水花' })
    enableRandomSplash: boolean = true;

    @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '随机水花力度' })
    randomSplashForce: number = 0.05;

    @property({ range: [0.1, 3, 0.1], slide: true, tooltip: '随机水花间隔（秒）' })
    randomSplashInterval: number = 0.3;

    @property({ tooltip: '开启自动波浪流动' })
    enableAutoWave: boolean = true;

    @property({ range: [0.1, 10, 0.1], slide: true, tooltip: '自动波浪流速' })
    autoWaveSpeed: number = 2;

    @property({ range: [0.5, 10, 0.5], slide: true, tooltip: '自动波浪高度（像素）' })
    autoWaveAmplitude: number = 3;

    @property({ range: [0.01, 0.2, 0.01], slide: true, tooltip: '自动波浪频率（越大越密）' })
    autoWaveFrequency: number = 0.05;

    @property({ range: [-1, 1, 0.1], slide: true, tooltip: '自动波浪方向（1右 -1左）' })
    autoWaveDirection: number = 1;

    // ==================== 视觉 ====================

    @property({ tooltip: '水面线条颜色' })
    surfaceColor: Color = new Color(100, 180, 255, 255);

    @property({ tooltip: '水体填充颜色' })
    bodyColor: Color = new Color(30, 80, 180, 180);

    @property({ range: [1, 10, 1], tooltip: '水面线条粗细' })
    lineWidth: number = 4;

    // ==================== 内部数据 ====================

    private _graphics: Graphics | null = null;
    private _heights: number[] = [];
    private _velocities: number[] = [];
    private _deltas: number[] = [];
    private _springSpacing: number = 0;
    private _surfaceY: number = 0;
    private _bottomY: number = 0;
    private _leftX: number = 0;
    private _elapsedTime: number = 0;
    private _tempVec3 = new Vec3();

    // ==================== 生命周期 ====================

    onLoad() {
        this._graphics = this.getComponent(Graphics);
        this._initSprings();
        this._registerCollision();
    }

    start() {
        if (this.enableRandomSplash) {
            this.schedule(this._randomSplash, this.randomSplashInterval);
        }
    }

    update(dt: number) {
        this._elapsedTime += dt;
        this._updateSprings();
        this._propagateWaves();
        this._drawWater();
    }

    onDestroy() {
        this._unregisterCollision();
    }

    // ==================== 初始化 ====================

    private _initSprings() {
        this._leftX = -this.waterWidth / 2;
        this._surfaceY = this.waterHeight / 2;
        this._bottomY = -this.waterHeight / 2;
        this._springSpacing = this.waterWidth / (this.springCount + 1);

        this._heights = new Array(this.springCount).fill(0);
        this._velocities = new Array(this.springCount).fill(0);
        this._deltas = new Array(this.springCount).fill(0);

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

    // ==================== 碰撞检测 ====================

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

    private _onBeginContact(
        selfCollider: Collider2D,
        otherCollider: Collider2D,
        contact: IPhysics2DContact | null
    ) {
        const otherBody = otherCollider.node.getComponent(RigidBody2D);
        if (!otherBody) return;

        const otherWorldPos = otherCollider.node.worldPosition;
        const localPos = this.node.inverseTransformPoint(this._tempVec3, otherWorldPos);
        const springIndex = this._findNearestSpring(localPos.x);
        const velocity = otherBody.linearVelocity;

        const clampedVel = Math.max(
            -this.maxSplashVelocity,
            Math.min(this.maxSplashVelocity, velocity.y / this.splashDamping)
        );

        this.splash(springIndex, clampedVel);
    }

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

    /**
     * 在指定弹簧位置产生波浪。
     * @param index 弹簧索引
     * @param velocity 施加的速度（正=向上，负=向下）
     */
    public splash(index: number, velocity: number) {
        if (index >= 0 && index < this.springCount) {
            this._velocities[index] += velocity;
        }
    }

    /**
     * 在指定世界 X 坐标处产生波浪（自动找最近弹簧）。
     * 方便外部调用，不需要知道弹簧索引。
     */
    public splashAtWorldX(worldX: number, velocity: number) {
        this._tempVec3.set(worldX, 0, 0);
        const localPos = this.node.inverseTransformPoint(this._tempVec3, this._tempVec3);
        const index = this._findNearestSpring(localPos.x);
        this.splash(index, velocity);
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
        const deltas = this._deltas;
        deltas.fill(0);

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

    private _randomSplash() {
        const index = Math.floor(Math.random() * this.springCount);
        this.splash(index, this.randomSplashForce * (Math.random() > 0.5 ? 1 : -1));
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
        const autoWave = this.enableAutoWave;
        const time = this._elapsedTime;

        // ===== 填充水体 =====
        g.fillColor = this.bodyColor;
        g.moveTo(leftX, bottomY);
        g.lineTo(leftX, surfaceY);

        for (let i = 0; i < this.springCount; i++) {
            const x = this._getSpringX(i);
            let y = this._getSpringY(i);
            if (autoWave) {
                y += Math.sin(x * this.autoWaveFrequency + time * this.autoWaveSpeed * this.autoWaveDirection) * this.autoWaveAmplitude;
            }
            g.lineTo(x, y);
        }

        g.lineTo(rightX, surfaceY);
        g.lineTo(rightX, bottomY);
        g.close();
        g.fill();

        // ===== 水面线条 =====
        g.strokeColor = this.surfaceColor;
        g.lineWidth = this.lineWidth;
        g.moveTo(leftX, surfaceY);

        for (let i = 0; i < this.springCount; i++) {
            const x = this._getSpringX(i);
            let y = this._getSpringY(i);
            if (autoWave) {
                y += Math.sin(x * this.autoWaveFrequency + time * this.autoWaveSpeed * this.autoWaveDirection) * this.autoWaveAmplitude;
            }
            g.lineTo(x, y);
        }

        g.lineTo(rightX, surfaceY);
        g.stroke();
    }
}
```

## 4. 最终配置清单

### Water 节点组件

```
Water (Node)
├── UITransform            (自动) ContentSize 由脚本设置
├── Graphics               (手动添加) 用于绘制水面
├── RigidBody2D            (手动添加) Type: Static
├── BoxCollider2D          (手动添加) Sensor: ✅
│   ├── Size: (waterWidth, 30)
│   └── Offset: (0, waterHeight/2)
└── WaterController        (手动添加) 我们的脚本
```

### Inspector 推荐参数

```
WaterController
├── Water Width: 800
├── Water Height: 300
├── Spring Count: 20
├── Spring Stiffness: 0.1
├── Dampening: 0.03
├── Spread: 0.006
├── Splash Damping: 50
├── Max Splash Velocity: 8
├── Enable Random Splash: ✅
├── Random Splash Force: 0.05
├── Random Splash Interval: 0.3
├── Enable Auto Wave: ✅
├── Auto Wave Speed: 2
├── Auto Wave Amplitude: 3
├── Auto Wave Frequency: 0.05
├── Auto Wave Direction: 1
├── Surface Color: (100, 180, 255, 255)
├── Body Color: (30, 80, 180, 180)
└── Line Width: 4
```

### 掉落物体（Ball）

```
Ball (Node)
├── Sprite            图片随意
├── UITransform
├── RigidBody2D       Type: Dynamic, GravityScale: 10
└── CircleCollider2D  Radius: 根据图片大小调整
```

## 5. 最终验收标准

- [ ] **基础功能**
  - [ ] 水面显示正常（填充 + 线条）
  - [ ] 物体掉入水中产生波浪
  - [ ] 波浪向两边传播并消散
- [ ] **进阶功能**
  - [ ] 随机水花效果正常
  - [ ] 自动波浪流动正常
  - [ ] 两个效果可独立开关
- [ ] **交互**
  - [ ] 从不同位置掉落，波浪在碰撞位置产生
  - [ ] 从不同高度掉落，波浪大小不同但有限制
- [ ] **性能**
  - [ ] 60fps 稳定
  - [ ] 无 Console 报错
- [ ] **参数调节**
  - [ ] 所有 Inspector 参数可实时调整
  - [ ] 调参后效果变化符合预期

## 6. 进阶拓展方向

完成基础版后，可以继续探索：

| 方向 | 说明 |
|------|------|
| 自定义 Mesh | 用 `MeshRenderer` + 程序化 Mesh 替代 Graphics，支持自定义 Shader |
| 水面 .effect | 写一个 `.effect` 文件给水体添加纹理、折射、焦散等视觉效果 |
| 浮力系统 | 检测物体在水中的深度，施加向上的力模拟浮力 |
| 水花粒子 | 碰撞时用粒子系统喷出水花特效 |
| 多层水面 | 前景水面 + 背景水面，不同透明度/速度形成深度感 |
| 触摸交互 | 手指滑过水面产生波浪，而不只是物体掉落 |

> **恭喜完成！** 从零到一，你用一个 TypeScript 文件实现了完整的 2D 交互水面。
>
> 回顾整个旅程：
> 1. 理解弹簧物理原理
> 2. 初始化弹簧数据（两个数组搞定）
> 3. 用 Graphics 组件画水面多边形
> 4. 胡克定律 + 阻尼让弹簧弹动
> 5. 高度差传播让波浪扩散
> 6. 2D 物理碰撞让物体入水触发波浪
> 7. 随机水花 + 正弦波自动流动
> 8. 性能优化 + 完整配置
