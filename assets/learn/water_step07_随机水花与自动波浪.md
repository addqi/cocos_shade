# Step 07：随机水花与自动波浪流动

## 1. 需求是什么

水面交互已经完成，但静态的水面不够生动。这一步加两个效果：

### 效果一：随机水花

每隔一段时间，随机选一个弹簧给它一个小冲量 → 水面不断有微小波纹。

```
没有随机水花（死水）：
──────────────────────────

有了随机水花（活水）：
──~─────~──────~──────~───
    ↑         ↑         ↑
  随机位置  随机位置  随机位置
```

### 效果二：自动波浪流动

水面持续有正弦波形状在流动，像河水一样。

```
没有自动流动：
──────────────────────────

有了自动流动（向右流）：
~  ~  ~  ~  ~  ~  ~  ~  → 
```

**Cocos 版的巨大优势**：因为我们每帧都用代码重新计算弹簧位置并绘制，自动波浪直接在代码里加一个 `Math.sin()` 偏移就行，**不需要 Shader！** 比 Unity 版简单太多。

Unity 版需要 ShaderGraph 来移动顶点，是因为 SpriteShape 的顶点由引擎管理，只能在 Shader 里改。而我们的 `Graphics` 绘制完全由代码控制，想加什么偏移都行。

### 这一步做什么

```
✅ 随机水花参数 + schedule 定时调用
✅ 自动波浪参数 + 正弦波偏移
✅ 在 _drawWater 中叠加波浪偏移
```

## 2. 具体完整代码

### 新增 Inspector 参数

在类的参数声明区域添加：

```typescript
// ==================== 波浪效果参数 ====================

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

@property({ range: [0.01, 0.2, 0.01], slide: true, tooltip: '自动波浪频率（越大波浪越密）' })
autoWaveFrequency: number = 0.05;

@property({ range: [-1, 1, 0.1], slide: true, tooltip: '自动波浪方向（1=向右，-1=向左）' })
autoWaveDirection: number = 1;
```

### 新增内部变量

```typescript
private _elapsedTime: number = 0;  // 累计时间，用于波浪动画
```

### 修改 start 方法

```typescript
start() {
    // 启动随机水花定时器
    if (this.enableRandomSplash) {
        this.schedule(this._randomSplash, this.randomSplashInterval);
    }
}
```

### 新增随机水花方法

```typescript
/**
 * 随机选一个弹簧，施加一个小冲量。
 * 由 schedule 定时调用。
 */
private _randomSplash() {
    const index = Math.floor(Math.random() * this.springCount);
    this.splash(index, this.randomSplashForce * (Math.random() > 0.5 ? 1 : -1));
}
```

### 修改 update 方法

```typescript
update(dt: number) {
    this._elapsedTime += dt;     // ★ 累计时间
    this._updateSprings();
    this._propagateWaves();
    this._drawWater();
}
```

### 修改 _drawWater 方法

在绘制弹簧点时，叠加自动波浪偏移。核心改动：

```typescript
private _drawWater() {
    const g = this._graphics;
    if (!g) return;
    g.clear();

    const leftX = this._leftX;
    const rightX = -this._leftX;
    const surfaceY = this._surfaceY;
    const bottomY = this._bottomY;

    // ===== 填充水体 =====
    g.fillColor = this.bodyColor;
    g.moveTo(leftX, bottomY);
    g.lineTo(leftX, surfaceY);

    for (let i = 0; i < this.springCount; i++) {
        const x = this._getSpringX(i);
        let y = this._getSpringY(i);

        // ★ 叠加自动波浪偏移
        if (this.enableAutoWave) {
            y += Math.sin(
                x * this.autoWaveFrequency
                + this._elapsedTime * this.autoWaveSpeed * this.autoWaveDirection
            ) * this.autoWaveAmplitude;
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

        // ★ 同样叠加自动波浪
        if (this.enableAutoWave) {
            y += Math.sin(
                x * this.autoWaveFrequency
                + this._elapsedTime * this.autoWaveSpeed * this.autoWaveDirection
            ) * this.autoWaveAmplitude;
        }

        g.lineTo(x, y);
    }

    g.lineTo(rightX, surfaceY);
    g.stroke();
}
```

### 自动波浪的数学

```
y_offset = sin(x × frequency + time × speed × direction) × amplitude

分解：
- x × frequency     → 波浪沿 X 轴分布的密度
- time × speed       → 波浪随时间推移的速度
- × direction        → 正数向右流，负数向左流
- sin(...)           → 产生 -1 到 1 的正弦波
- × amplitude        → 控制波浪高度

例：frequency=0.05, speed=2, amplitude=3
  x=0:   sin(0 + t×2) × 3     → ±3 像素
  x=100: sin(5 + t×2) × 3     → 不同相位的 ±3 像素

所有弹簧的偏移相位不同 → 形成流动的波浪
```

```
  时刻 t=0:     /\    /\    /\
               /  \  /  \  /  \

  时刻 t=0.5:    /\    /\    /\
                /  \  /  \  /  \
                → 整体向右移动了

  这就是"流动"的效果！
```

### 为什么随机水花用 schedule 而不是 setInterval？

```typescript
// ✅ Cocos 推荐：schedule
this.schedule(this._randomSplash, 0.3);

// ❌ 不推荐：setInterval
setInterval(() => this._randomSplash(), 300);
```

`schedule` 是 Cocos 的定时器系统：
- 组件销毁时自动清理（不会内存泄漏）
- 暂停游戏时自动暂停
- 受 `timeScale` 影响
- 用 `unschedule()` 方便取消

`setInterval` 是浏览器 API，组件销毁后还在跑 → 内存泄漏 + 空引用报错。

## 3. 验收标准

### 随机水花

- [ ] `enableRandomSplash` 参数可在 Inspector 切换
- [ ] `_randomSplash()` 方法已添加
- [ ] `start()` 中用 `schedule` 启动定时调用
- [ ] 运行游戏：
  - [ ] 水面不断有小波纹随机冒出
  - [ ] 调整 `randomSplashForce` → 波纹大小变化
  - [ ] 调整 `randomSplashInterval` → 波纹频率变化

### 自动波浪流动

- [ ] 四个参数可在 Inspector 调整（speed, amplitude, frequency, direction）
- [ ] `_elapsedTime` 在 `update()` 中累加
- [ ] `_drawWater()` 中正确叠加了正弦波偏移
- [ ] 运行游戏：
  - [ ] 水面有持续的正弦波起伏
  - [ ] 波浪在**流动**（不是原地震荡）
  - [ ] `direction` 改为 -1 → 流动方向反转
  - [ ] `amplitude` = 0 → 自动波浪消失
  - [ ] `speed` 增大 → 流动加快

### 综合

- [ ] 随机水花 + 自动波浪 + 物体碰撞三者同时运作，效果自然
- [ ] 关闭任何一个效果不影响其他两个

> **小白常见问题**：
> - Q: 自动波浪看不出"流动"？ → `autoWaveSpeed` 太小了，调到 3~5
> - Q: 波浪太密/太疏？ → 调整 `autoWaveFrequency`
> - Q: 随机水花太大，盖过了其他效果？ → 降低 `randomSplashForce`
> - Q: 关掉自动波浪后 `_elapsedTime` 还在涨？ → 没关系，不影响性能
