# Step 02：数据结构与初始化

## 1. 需求是什么

搭建闪电控制器的**骨架**：定义 Inspector 可调参数、声明内部数据、获取组件引用。

### 这一步做什么

```
✅ 定义所有 Inspector 参数（闪电外观、算法参数、动画参数）
✅ 声明内部数据（闪电点数组、计时器、状态标记）
✅ onLoad 获取 Graphics 引用
✅ 坐标转换辅助方法 _getLocalPos

❌ 算法实现（Step 03）
❌ 绘制（Step 04）
❌ 动画（Step 05）
```

### 数据结构设计思路

```
Unity 版的数据：
- List<(Vector3, Vector3)> segmentList  ← 线段列表
- LineRenderer                           ← 画线组件
- Vector2 matTextureOffset[]             ← 材质偏移数组

Cocos 版的数据：
- Vec2[][] _bolts    ← 多条闪电的点序列（更直接）
- Graphics           ← 画线组件
- 不需要材质相关数据  ← 用颜色/线宽代替

关键简化：
Unity 存 (start, end) 线段对 → Cocos 存有序点数组
线段对需要遍历配对 → 点数组直接 moveTo + lineTo
```

## 2. 具体完整代码

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

    /** 多条闪电的点序列。_bolts[i] = 第 i 条闪电的有序点数组 */
    private _graphics: Graphics | null = null;
    private _bolts: Vec2[][] = [];
    private _flashTimer: number = 0;
    private _durationTimer: number = 0;
    private _isActive: boolean = false;
    /** 复用的临时 Vec3，避免每帧 new */
    private _tempVec3: Vec3 = new Vec3();

    // ==================== 生命周期 ====================

    onLoad() {
        this._graphics = this.getComponent(Graphics);
    }

    // ==================== 坐标转换 ====================

    /**
     * 把目标节点的世界坐标转为本节点的本地坐标（Vec2）。
     * 因为 Graphics 在本地空间绘制，所有坐标必须先转换。
     */
    private _getLocalPos(targetNode: Node): Vec2 {
        const worldPos = targetNode.worldPosition;
        this.node.inverseTransformPoint(this._tempVec3, worldPos);
        return new Vec2(this._tempVec3.x, this._tempVec3.y);
    }
}
```

### 参数分类解读

#### 算法参数

```
subdivision（递归次数）
┌─────────────────────────┐
│ 值   │ 线段数  │ 效果     │
│──────│────────│─────────│
│  3   │   8    │ 粗糙锯齿 │
│  5   │  32    │ 自然闪电 │ ← 推荐
│  7   │ 128    │ 极度精细 │
│  8   │ 256    │ 性能警告 │
└─────────────────────────┘

chaosFactor（混乱系数）
0.05: ────~~~~~──── 几乎是直线
0.15: ──╱╲──╱╲╱── 自然闪电 ← 推荐
0.30: ╱╲╱╲╱╲╱╲╱╲ 疯狂锯齿
0.50: 完全混乱，不像闪电了
```

#### 外观参数

```
闪电绘制分两层：
┌──────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 辉光层（宽 + 半透明）│
│    ████████████  核心层（窄 + 不透明）  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓                      │
└──────────────────────────────────────┘

glowColor: 建议 alpha 设为 60~100（半透明）
glowWidth: 比 coreWidth 大 4~10 倍
coreColor: 建议接近白色（闪电核心是最亮的）
coreWidth: 1~3 像素
```

#### 动画参数

```
flashInterval = 0.05 秒
→ 每 0.05 秒重新生成一次闪电路径
→ 因为每次随机不同，看起来在"闪烁"
→ 这就是动画的全部秘密：不断重新生成

duration = 0
→ 0 表示无限持续
→ 设为 2 则闪电 2 秒后自动停止
```

#### 关于 `_tempVec3`

```
为什么不直接 new Vec3()？

每帧可能调用多次 _getLocalPos
每次 new 都会产生垃圾对象
GC（垃圾回收）可能导致卡顿

解决：预先创建一个 Vec3 复用它
这是游戏开发中的常见优化模式
```

## 3. 验收标准

- [ ] 所有 `@property` 参数已定义，Inspector 中可见且可调节
- [ ] `_graphics`、`_bolts`、`_flashTimer` 等内部数据已声明
- [ ] `onLoad()` 中获取了 Graphics 组件引用
- [ ] `_getLocalPos()` 辅助方法已实现
- [ ] 运行项目无报错（虽然还看不到任何东西）
- [ ] 在 Inspector 中：
  - [ ] `subdivision` 显示为滑条，范围 1~8
  - [ ] `chaosFactor` 显示为滑条，范围 0.01~0.5
  - [ ] `coreColor` 和 `glowColor` 显示为颜色选择器
  - [ ] `Start Node` 和 `End Node` 可以拖入节点

> **小白常见问题**：
> - Q: `@executeInEditMode` 是什么？ → 让脚本在编辑器中也运行，方便实时预览效果
> - Q: `Vec2` 和 `Vec3` 有什么区别？ → Vec2 = (x, y)，Vec3 = (x, y, z)。2D 闪电只需要 x/y
> - Q: 为什么 `_bolts` 是 `Vec2[][]`？ → 外层数组 = 多条闪电，内层数组 = 一条闪电的所有点
> - Q: `inverseTransformPoint` 是什么？ → 把世界坐标转成节点的本地坐标。Graphics 画的线都在本地空间
