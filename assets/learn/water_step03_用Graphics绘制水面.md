# Step 03：用 Graphics 组件绘制水面

## 1. 需求是什么

弹簧数据已经准备好了，现在要把水面**画出来**。

在 Cocos Creator 中，`Graphics` 组件是 2D 矢量绘图工具，类似 HTML Canvas 的 2D API。我们用它每帧画一个多边形来表示水体。

### 绘制流程

```
步骤 1: moveTo(左下角)
        ●

步骤 2: lineTo(左上角)
        |
        ●

步骤 3: 逐个 lineTo 每个弹簧点（水面线）
        |
        ● ── ● ── ● ── ● ── ●

步骤 4: lineTo(右上角) → lineTo(右下角)
        |                         |
        ● ── ● ── ● ── ● ── ●  |
                                  ●

步骤 5: close() → fill() → 得到填充水体
        ┌── ● ── ● ── ● ── ● ──┐
        │       水体填充          │
        └────────────────────────┘

步骤 6: 再 stroke() 画水面线条
        ╔══ ● ══ ● ══ ● ══ ● ══╗ ← 粗线条
        │       水体填充          │
        └────────────────────────┘
```

### 这一步做什么

```
✅ _drawWater() 方法：绘制水体多边形 + 水面线条
✅ 在 update() 中每帧重绘
✅ 能在编辑器中实时看到静态水面

❌ 弹簧物理（Step 04）
❌ 水面还不会动
```

## 2. 具体完整代码

在 `WaterController.ts` 中添加两个方法 `_drawWater()` 和 `update()`：

```typescript
import { _decorator, Component, Graphics, Color, UITransform } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('WaterController')
@executeInEditMode
export class WaterController extends Component {

    // ==================== Inspector 参数（同 Step 02，不变） ====================
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

    // ==================== 内部数据（同 Step 02） ====================
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
    }

    update(dt: number) {
        // 每帧重绘水面
        this._drawWater();
    }

    // ==================== 初始化（同 Step 02，不变） ====================

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

    // ==================== ★ 新增：绘制水面 ====================

    /**
     * 每帧调用：清除画布，重新绘制水体多边形和水面线条。
     */
    private _drawWater() {
        const g = this._graphics;
        if (!g) return;

        g.clear(); // 清除上一帧的绘制内容

        const leftX = this._leftX;
        const rightX = -this._leftX; // waterWidth / 2
        const surfaceY = this._surfaceY;
        const bottomY = this._bottomY;

        // ===== 第一层：填充水体 =====
        g.fillColor = this.bodyColor;

        g.moveTo(leftX, bottomY);           // 1. 左下角
        g.lineTo(leftX, surfaceY);          // 2. 左上角（水面左端）

        // 3. 沿着弹簧点画水面线
        for (let i = 0; i < this.springCount; i++) {
            g.lineTo(this._getSpringX(i), this._getSpringY(i));
        }

        g.lineTo(rightX, surfaceY);         // 4. 右上角（水面右端）
        g.lineTo(rightX, bottomY);          // 5. 右下角
        g.close();                           // 6. 闭合路径
        g.fill();                            // 7. 填充

        // ===== 第二层：画水面线条 =====
        g.strokeColor = this.surfaceColor;
        g.lineWidth = this.lineWidth;

        g.moveTo(leftX, surfaceY);          // 从左端开始

        for (let i = 0; i < this.springCount; i++) {
            g.lineTo(this._getSpringX(i), this._getSpringY(i));
        }

        g.lineTo(rightX, surfaceY);         // 到右端结束
        g.stroke();                          // 描边
    }
}
```

### 关键 API 解读

#### `g.clear()`

每帧必须先清除上一帧画的内容。`Graphics` 不像 `Sprite` 有固定图片——它是"手动画布"，每帧你画什么就显示什么。

```
帧 1: 画了波浪 A
帧 2: 不清除 → A + B 重叠 → 乱了
帧 2: 先 clear() → 只有 B → 正确
```

#### `g.moveTo()` vs `g.lineTo()`

```
moveTo = "提起笔，移到这个位置"（不画线）
lineTo = "从当前位置画一条线到目标位置"

moveTo(0, 0) → lineTo(100, 0) → lineTo(100, 100)
画出了一个 L 形
```

#### `g.close()` + `g.fill()`

```
close() = "从当前位置画一条线回到 moveTo 的起点，形成闭合图形"
fill()  = "用 fillColor 填满闭合区域"
```

#### 为什么先 fill 再 stroke？

```
如果先 stroke 再 fill：线条会被填充覆盖一半（内侧）
如果先 fill 再 stroke：线条画在填充上面，完整可见 ✅
```

### 绘制顺序图示

```
Step 1-6（fill 路径）：              Step 7-9（stroke 路径）：

  ┌──────────────────┐              ════════════════════
  │                  │                  （只画上面的线）
  │   bodyColor 填充  │
  │                  │
  └──────────────────┘
```

## 3. 验收标准

- [ ] `_drawWater()` 方法已添加
- [ ] `update()` 方法中调用了 `_drawWater()`
- [ ] **运行后能看到一个矩形水体**：
  - [ ] 下面是 `bodyColor` 的半透明填充
  - [ ] 上面有 `surfaceColor` 的线条
  - [ ] 水面线条目前是**一条直线**（因为 heights 全是 0）
- [ ] 在 Inspector 中修改颜色参数，水体颜色实时变化
- [ ] 修改 `waterWidth` / `waterHeight`，水体大小变化
- [ ] 修改 `lineWidth`，水面线条粗细变化

> **首次看到水面了！** 虽然还是一条死的直线，但下一步加上物理后它就活了。

> **小白常见问题**：
> - Q: 运行后什么都看不到？ → 检查 `Water` 节点是否在摄像机视野内（调整位置）
> - Q: 看到了但颜色不对？ → 检查 `bodyColor` 的 Alpha 值（第4个分量），0 = 完全透明
> - Q: 线条看不到？ → `surfaceColor` 的 Alpha 是否为 255（不透明）
> - Q: 编辑器里看不到，运行才看到？ → 确认加了 `@executeInEditMode`
