# Step 05：波浪传播 - 弹簧之间的力传递

## 1. 需求是什么

上一步弹簧能弹了，但是只有被碰的那一个点在动——旁边的点纹丝不动。

这一步实现**波浪传播**：高度差产生传播力，让波浪像真实水面一样向两边扩散。

### 传播力公式

```
传播力 = spread × (自己的高度 - 邻居的高度)
```

直觉理解：一个弹簧比旁边的高 → 它会把旁边的"拉上来"；比旁边的低 → 把旁边的"拉下去"。

### 为什么分两遍计算？

```
❌ 错误做法（边算边改）：
弹簧:  A(h=5)  B(h=0)  C(h=0)

处理 A→B: B.vel += spread×(5-0)，B的高度在下一步会变
处理 B→C: B 已经被改过了！C 收到的力不对称

✅ 正确做法（先算后改）：
第一遍：用原始高度算出所有传播力，存到临时数组
第二遍：把传播力统一加到所有弹簧的速度上

结果：波浪完美对称！
```

### 这一步做什么

```
✅ _propagateWaves() 方法：两遍循环计算波浪传播
✅ 在 update() 中调用

完成后水面就真正"活"了！
```

## 2. 具体完整代码

### 添加 _propagateWaves 方法

在 `_updateSprings()` 后面添加：

```typescript
/**
 * 波浪传播：计算弹簧之间的力传递。
 * 两遍循环：第一遍算力，第二遍统一应用（保证对称性）。
 */
private _propagateWaves() {
    const count = this.springCount;
    const deltas = new Array(count).fill(0);

    // 第一遍：计算每个弹簧收到的传播力
    for (let i = 0; i < count; i++) {
        // 向左传播
        if (i > 0) {
            deltas[i - 1] += this.spread * (this._heights[i] - this._heights[i - 1]);
        }
        // 向右传播
        if (i < count - 1) {
            deltas[i + 1] += this.spread * (this._heights[i] - this._heights[i + 1]);
        }
    }

    // 第二遍：统一应用到速度
    for (let i = 0; i < count; i++) {
        this._velocities[i] += deltas[i];
    }
}
```

### 修改 update 方法

```typescript
update(dt: number) {
    this._updateSprings();     // 1. 胡克定律 + 阻尼
    this._propagateWaves();    // 2. ★ 波浪传播
    this._drawWater();          // 3. 绘制
}
```

### 传播过程可视化

假设 `spread = 0.1`，初始状态只有弹簧 3 被按下：

```
帧 0:  heights = [0, 0, 0, -10, 0, 0, 0]
                            ↑ 被按下

帧 1 传播计算：
  弹簧2 收到: 0.1 × (-10 - 0) = -1     (被往下拉)
  弹簧4 收到: 0.1 × (-10 - 0) = -1     (被往下拉)

帧 1:  heights ≈ [0, 0, -1, -8, -1, 0, 0]
                       ↓       ↓
                   波浪开始扩散

帧 2:  heights ≈ [0, -0.1, -1.5, -5, -1.5, -0.1, 0]
                     ↓              ↓
                 继续扩散...

帧 N:  heights ≈ [0, 0, 0, 0, 0, 0, 0]
                全部恢复平静 ✅
```

### 参数对效果的影响

| 参数 | 效果 |
|------|------|
| `spread` 很大 (0.05) | 波浪传得快，一瞬间整个水面都在动 |
| `spread` 很小 (0.001) | 波浪传得慢，像粘稠的液体 |
| `spread` = 0 | 完全不传播，只有被碰的点自己弹 |

## 3. 验收标准

- [ ] `_propagateWaves()` 方法已添加
- [ ] `update()` 中顺序为：`_updateSprings()` → `_propagateWaves()` → `_drawWater()`
- [ ] **运行游戏**（确保 `start()` 中有 splash 测试代码）：
  - [ ] 中间弹簧被按下后，**波浪向两边扩散**
  - [ ] 扩散是**对称的**（左右一样）
  - [ ] 波浪到达边缘后会**反弹回来**
  - [ ] 最终所有弹簧恢复平静
- [ ] 调参测试：
  - [ ] `spread` 增大 → 波浪传播更快
  - [ ] `spread` 减小 → 波浪传播更慢
  - [ ] `springCount` 增多 → 水面曲线更细腻

> **里程碑！** 水面物理完成了。一个弹簧动起来，波浪就会向两边扩散，最终恢复平静。
> 接下来让物体掉进水里自动触发波浪。

> **小白常见问题**：
> - Q: 波浪不扩散？ → 检查 `spread` 不为 0
> - Q: 波浪不消失？ → `dampening` 太小了，加大
> - Q: 水面直接炸了？ → `spread` 太大或 `springStiffness` 太大，调小
> - Q: 只有一个点动？ → 确认 `_propagateWaves()` 在 `update()` 中被调用了
