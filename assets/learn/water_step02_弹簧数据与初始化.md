# Step 02：弹簧数据结构与初始化

## 1. 需求是什么

这一步要完成 `WaterController.ts` 的**骨架**——定义水面需要的所有参数，初始化弹簧数据。

### Cocos 版弹簧 vs Unity 版弹簧

```
Unity 版（重量级）：
每个弹簧 = 1个 GameObject + 1个 WaterSpring 组件 + 1个 BoxCollider2D
20个弹簧 = 20个节点！

Cocos 版（轻量级）：
每个弹簧 = 2个数字（height + velocity）
20个弹簧 = 2个长度20的数组。完事。
```

弹簧不需要是节点或组件，因为它只需要两个数据：
- **当前高度**（相对于水面静止位置的偏移量）
- **当前速度**（每帧高度的变化量）

### 这一步做什么

```
✅ 定义所有 @property 参数（Inspector 可调）
✅ 初始化弹簧数组 heights[] 和 velocities[]
✅ 获取 Graphics 组件引用

❌ 绘制水面（Step 03）
❌ 物理计算（Step 04）
❌ 波浪传播（Step 05）
```

### 参数总览

```
WaterController
├── 水面尺寸
│   ├── waterWidth = 800     水面宽度（像素）
│   └── waterHeight = 300    水面高度（像素）
│
├── 弹簧物理
│   ├── springCount = 20      弹簧点数量
│   ├── springStiffness = 0.1 弹性系数（水的"硬度"）
│   ├── dampening = 0.03      阻尼系数（水波消失速度）
│   └── spread = 0.006        传播系数（波浪传播速度）
│
├── 视觉
│   ├── surfaceColor          水面线条颜色
│   ├── bodyColor             水体填充颜色
│   └── lineWidth = 4         水面线条粗细
│
└── 内部数据
    ├── heights[]             每个弹簧的 Y 偏移
    ├── velocities[]          每个弹簧的 Y 速度
    └── springSpacing         弹簧之间的 X 间距
```

## 2. 具体完整代码

在 `assets/scripts/WaterController.ts` 中写入以下内容：

```typescript
import { _decorator, Component, Graphics, Color, UITransform } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('WaterController')
@executeInEditMode // 编辑器里也能看到效果，方便调参
export class WaterController extends Component {

    // ==================== Inspector 参数 ====================

    @property({ tooltip: '水面宽度（像素）' })
    waterWidth: number = 800;

    @property({ tooltip: '水面高度（像素）' })
    waterHeight: number = 300;

    @property({ range: [3, 100, 1], slide: true, tooltip: '弹簧点数量，越多水面越细腻' })
    springCount: number = 20;

    @property({ range: [0.01, 1, 0.01], slide: true, tooltip: '弹性系数：越大弹得越猛，水越"硬"' })
    springStiffness: number = 0.1;

    @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '阻尼系数：越大停得越快' })
    dampening: number = 0.03;

    @property({ range: [0.001, 0.1, 0.001], slide: true, tooltip: '传播系数：越大波浪传得越远' })
    spread: number = 0.006;

    @property({ tooltip: '水面线条颜色' })
    surfaceColor: Color = new Color(100, 180, 255, 255);

    @property({ tooltip: '水体填充颜色' })
    bodyColor: Color = new Color(30, 80, 180, 180);

    @property({ range: [1, 10, 1], tooltip: '水面线条粗细' })
    lineWidth: number = 4;

    // ==================== 内部数据 ====================

    private _graphics: Graphics | null = null;  // Graphics 组件引用
    private _heights: number[] = [];             // 每个弹簧的 Y 偏移（0 = 静止）
    private _velocities: number[] = [];          // 每个弹簧的 Y 速度
    private _springSpacing: number = 0;          // 弹簧间距
    private _surfaceY: number = 0;               // 水面静止时的 Y 坐标（本地空间）
    private _bottomY: number = 0;                // 水底 Y 坐标（本地空间）
    private _leftX: number = 0;                  // 左边界 X

    // ==================== 生命周期 ====================

    onLoad() {
        this._graphics = this.getComponent(Graphics);
        this._initSprings();
    }

    /**
     * 初始化弹簧数据。
     * 所有弹簧从静止状态开始（高度偏移=0，速度=0）。
     */
    private _initSprings() {
        // 计算坐标系（以节点中心为原点）
        this._leftX = -this.waterWidth / 2;
        this._surfaceY = this.waterHeight / 2;
        this._bottomY = -this.waterHeight / 2;
        this._springSpacing = this.waterWidth / (this.springCount + 1);

        // 初始化数组：全部归零
        this._heights = new Array(this.springCount).fill(0);
        this._velocities = new Array(this.springCount).fill(0);

        // 同步 UITransform 尺寸（让节点大小匹配水面大小）
        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(this.waterWidth, this.waterHeight);
        }
    }

    /**
     * 获取第 i 个弹簧的 X 坐标（本地空间）。
     */
    private _getSpringX(i: number): number {
        return this._leftX + (i + 1) * this._springSpacing;
    }

    /**
     * 获取第 i 个弹簧当前的 Y 坐标（本地空间）。
     */
    private _getSpringY(i: number): number {
        return this._surfaceY + this._heights[i];
    }
}
```

### 逐段解读

#### `@executeInEditMode`

```typescript
@executeInEditMode // 不点播放按钮，编辑器里也能运行
```

相当于 Unity 的 `[ExecuteAlways]`。加了这个，在 Inspector 里拖滑块就能实时看到水面变化。

#### `@property` 的高级用法

```typescript
@property({ range: [3, 100, 1], slide: true, tooltip: '弹簧点数量' })
springCount: number = 20;
```

- `range: [min, max, step]` → Inspector 显示为滑块
- `slide: true` → 启用滑块模式
- `tooltip` → 鼠标悬停显示提示

这是 Cocos Creator 的 `@property` 装饰器，比 Unity 的 `[SerializeField][Range(...)][Tooltip(...)]` 写法更简洁。

#### 坐标系

```
以节点中心为原点：

         _surfaceY (+150)
_leftX ● ── ● ── ● ── ● ── ● _leftX + waterWidth
(-400)  S0   S1   S2   S3   S4   (+400)
         |                    |
         |    水体填充区域      |
         |                    |
         _bottomY (-150)

弹簧 i 的 X = _leftX + (i + 1) × spacing
弹簧 i 的 Y = _surfaceY + heights[i]
```

`(i + 1)` 是因为第一个弹簧不在最左边缘——左右边缘是固定的，弹簧在它们之间。

#### 为什么 heights 初始全为 0？

`heights[i]` 存的是**偏移量**，不是绝对位置。0 = 水面平静，正数 = 高于水面，负数 = 低于水面。

这比存绝对位置更好，因为：
- 弹力计算直接用 `heights[i]`（不需要减去 targetHeight）
- 重置很简单：全部归零

## 3. 验收标准

- [ ] `WaterController.ts` 文件已创建，代码无报错
- [ ] 脚本已挂载到 `Water` 节点
- [ ] Inspector 中能看到所有参数，带滑块和提示
  - [ ] `waterWidth`, `waterHeight`
  - [ ] `springCount`（滑块，3~100）
  - [ ] `springStiffness`（滑块，0.01~1）
  - [ ] `dampening`（滑块，0.01~0.5）
  - [ ] `spread`（滑块，0.001~0.1）
  - [ ] `surfaceColor`, `bodyColor`（颜色选择器）
  - [ ] `lineWidth`
- [ ] 运行后控制台无报错
- [ ] `Water` 节点的 UITransform ContentSize 自动设为 waterWidth × waterHeight

> **此时运行看不到任何视觉效果**——因为还没画水面。下一步搞定。

> **小白常见问题**：
> - Q: `@property` 的 range 不显示滑块？ → 确保加了 `slide: true`
> - Q: Color 类型在 Inspector 中显示不正常？ → 确保 `import { Color } from 'cc'`
> - Q: `@executeInEditMode` 报错？ → 确保从 `_decorator` 中解构了它
