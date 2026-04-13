# Step 04：弹簧物理 - 胡克定律与阻尼

## 1. 需求是什么

上一步画出了静态水面。这一步让弹簧**动起来**——加上胡克定律和阻尼力的物理计算。

### 每帧每个弹簧做的事

```
heights[i] 就是弹簧偏离水面的距离（正=上方，负=下方）

                    ↑ heights[i] > 0（高于水面）
~~~~~~~~ 水面 ~~~~~~~~ heights[i] = 0（平静）
                    ↓ heights[i] < 0（低于水面）
```

物理计算流程：

```
1. 弹力 = -stiffness × heights[i]
   （偏离越远，拉回的力越大；负号因为方向相反）

2. 阻尼力 = -dampening × velocities[i]
   （速度越快，阻力越大；让弹簧最终停下来）

3. 合力 = 弹力 + 阻尼力

4. 速度 += 合力
   （F=ma，质量=1，所以加速度=力）

5. 高度 += 速度
   （位移 = 速度 × 时间，时间步=1帧）
```

### 这一步做什么

```
✅ _updateSprings() 方法：计算每个弹簧的物理
✅ 在 update() 中先更新物理，再绘制
✅ 手动设置某个弹簧的 heights[i] 来测试弹动效果
```

## 2. 具体完整代码

在 `WaterController.ts` 中添加 `_updateSprings()` 方法，并修改 `update()`。

### 添加 _updateSprings 方法

```typescript
/**
 * 更新所有弹簧的物理状态（胡克定律 + 阻尼）。
 * 每帧在绘制前调用。
 */
private _updateSprings() {
    for (let i = 0; i < this.springCount; i++) {
        const h = this._heights[i];   // 当前偏移
        const v = this._velocities[i]; // 当前速度

        // 弹力：-k × x（偏离越远，拉回越猛）
        const springForce = -this.springStiffness * h;

        // 阻尼力：-c × v（速度越快，阻力越大）
        const dampForce = -this.dampening * v;

        // 合力 → 加速度（质量=1）→ 更新速度
        this._velocities[i] += springForce + dampForce;

        // 速度 → 更新位置
        this._heights[i] += this._velocities[i];
    }
}
```

### 修改 update 方法

```typescript
update(dt: number) {
    this._updateSprings();  // ★ 先更新物理
    this._drawWater();       // 再绘制
}
```

### 添加测试方法（临时，验证弹簧效果）

```typescript
/**
 * 给指定弹簧施加一个速度冲量。
 * 用于测试和外部调用。
 */
public splash(index: number, velocity: number) {
    if (index >= 0 && index < this.springCount) {
        this._velocities[index] += velocity;
    }
}

start() {
    // ★ 临时测试：给中间的弹簧施加一个向下的速度
    this.splash(Math.floor(this.springCount / 2), -5);
}
```

### 此步骤的完整代码

```typescript
import { _decorator, Component, Graphics, Color, UITransform } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('WaterController')
@executeInEditMode
export class WaterController extends Component {

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

    private _graphics: Graphics | null = null;
    private _heights: number[] = [];
    private _velocities: number[] = [];
    private _springSpacing: number = 0;
    private _surfaceY: number = 0;
    private _bottomY: number = 0;
    private _leftX: number = 0;

    onLoad() {
        this._graphics = this.getComponent(Graphics);
        this._initSprings();
    }

    start() {
        // 临时测试：给中间的弹簧一个冲量，看它弹不弹
        this.splash(Math.floor(this.springCount / 2), -5);
    }

    update(dt: number) {
        this._updateSprings();   // ★ 物理更新
        this._drawWater();
    }

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

    // ★ 新增：弹簧物理
    private _updateSprings() {
        for (let i = 0; i < this.springCount; i++) {
            const springForce = -this.springStiffness * this._heights[i];
            const dampForce = -this.dampening * this._velocities[i];
            this._velocities[i] += springForce + dampForce;
            this._heights[i] += this._velocities[i];
        }
    }

    // ★ 新增：外部接口
    public splash(index: number, velocity: number) {
        if (index >= 0 && index < this.springCount) {
            this._velocities[index] += velocity;
        }
    }

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

### 关键概念解读

#### 为什么 `springForce = -stiffness × heights[i]`？

```
弹簧在水面上方（heights > 0）→ 力要把它拉下来 → 力为负 → -k × 正数 = 负
弹簧在水面下方（heights < 0）→ 力要把它推上去 → 力为正 → -k × 负数 = 正

这就是胡克定律的 F = -kx：
方向永远和位移相反，始终朝着平衡位置拉。
```

#### 为什么 heights[i] 直接就是 x（偏移量）？

在 Unity 版中需要 `targetHeight - currentHeight` 计算偏移。
在我们的版本中，**heights[i] 本身就存的偏移量**（0 = 平衡位置），省掉了这步计算。

数据结构设计得好，代码就简洁。

#### 为什么不用 dt（deltaTime）？

简化版中我们假设每帧时间步固定为 1。严格来说应该：
```
velocity += force * dt
height += velocity * dt
```
但对于这个效果，固定步长足够了，而且避免了 dt 波动导致物理不稳定的问题。

## 3. 验收标准

- [ ] `_updateSprings()` 方法已添加
- [ ] `update()` 中先 `_updateSprings()` 再 `_drawWater()`
- [ ] `splash()` 公开方法已添加
- [ ] **运行游戏**：
  - [ ] 水面中间出现一个凹陷（start 里的测试 splash）
  - [ ] 凹陷的弹簧**上下弹动**
  - [ ] 弹动幅度**逐渐减小**，最终恢复平静（阻尼生效）
- [ ] 调参测试：
  - [ ] `springStiffness` 增大 → 弹得更猛更快
  - [ ] `dampening` 增大 → 更快恢复平静
  - [ ] `springStiffness` 很小 + `dampening` 很小 → 弹簧慢悠悠地晃很久

> **注意**：此时只有被 splash 的那一个弹簧在动，旁边的不动。
> 因为波浪传播还没实现——下一步搞定！

> **测试完记得把 start() 中的临时测试代码删掉或注释掉。**
