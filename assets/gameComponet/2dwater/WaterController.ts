import { _decorator, Collider2D, Vec3, Color, Component, Contact2DType, Graphics, IPhysics2DContact, Node, RigidBody2D, UITransform, Vec2 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('WaterController')
@executeInEditMode // 编辑器里也能看到效果，方便调参
export class WaterController extends Component {
    // ==================== Inspector 参数 ====================
    /** 水面宽度（像素） */
    @property({ tooltip: '水面宽度（像素）' })
    waterWidth: number = 800;

    /** 水面高度（像素） */
    @property({ tooltip: '水面高度（像素）' })
    waterHeight: number = 300;

    /** 弹簧点数量，越多水面越细腻 */
    @property({ range: [3, 100, 1], slide: true, tooltip: '弹簧点数量，越多水面越细腻' })
    springCount: number = 20;

    /** 弹性系数：越大弹得越猛，水越"硬" */
    @property({ range: [0.01, 1, 0.01], slide: true, tooltip: '弹性系数：越大弹得越猛，水越"硬"' })
    springStiffness: number = 0.1;

    /** 阻尼系数：越大停得越快 */
    @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '阻尼系数：越大停得越快' })
    dampening: number = 0.03;

    /** 传播系数：越大波浪传得越远 */
    @property({ range: [0.001, 0.1, 0.001], slide: true, tooltip: '传播系数：越大波浪传得越远' })
    spread: number = 0.006;

    /** 水面线条颜色 */
    @property({ tooltip: '水面线条颜色' })
    surfaceColor: Color = new Color(100, 180, 255, 255);

    /** 水体填充颜色 */
    @property({ tooltip: '水体填充颜色' })
    bodyColor: Color = new Color(30, 80, 180, 180);

    /** 水面线条粗细 */
    @property({ range: [1, 10, 1], tooltip: '水面线条粗细' })
    lineWidth: number = 4;
    @property({ range: [1, 200, 1], tooltip: '入水速度衰减系数（越大波浪越小）' })
    splashDamping: number = 50;

    @property({ range: [1, 20, 1], tooltip: '最大波浪速度限制' })
    maxSplashVelocity: number = 8;

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
    autoWaveSpeed: number = 3;

    @property({ range: [1, 30, 1], slide: true, tooltip: '自动波浪高度（像素）' })
    autoWaveAmplitude: number = 8;

    @property({ range: [0.005, 0.1, 0.001], slide: true, tooltip: '自动波浪频率（越小波越长越容易看出流动）' })
    autoWaveFrequency: number = 0.018;

    @property({ range: [-1, 1, 0.1], slide: true, tooltip: '自动波浪方向（1=向右，-1=向左）' })
    autoWaveDirection: number = 1;

    // ==================== 内部数据 ====================
    /** Graphics 组件引用 */
    private _graphics: Graphics | null = null;
    /** 每个弹簧的 Y 偏移（0 = 静止） */
    private _heights: number[] = [];
    /** 每个弹簧的 Y 速度 */
    private _velocities: number[] = [];
    /** 弹簧间距 */
    private _springSpacing: number = 0;
    /** 水面静止时的 Y 坐标（本地空间） */
    private _surfaceY: number = 0;
    /** 水底 Y 坐标（本地空间） */
    private _bottomY: number = 0;
    /** 左端 X 坐标（本地空间） */
    private _leftX: number = 0;
    /** 累计时间，用于波浪动画 */
    private _elapsedTime: number = 0;

    onLoad() {
        this._graphics = this.getComponent(Graphics);
        this._initSprings();
        this._registerCollision(); // ★ 注册碰撞
    }

    onDestroy() {
        this._unregisterCollision(); // ★ 注销碰撞
    }

    start() {
        if (this.enableRandomSplash) {
            this.schedule(this._randomSplash, this.randomSplashInterval);
        }
    }
    update(dt: number) {
        this._elapsedTime += dt;     // ★ 累计时间
        this._updateSprings();
        this._propagateWaves();
        this._drawWater();
    }
    private _registerCollision() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        } else {
            console.error('WaterController: Collider2D component not found');
        }
    }

    private _unregisterCollision() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.off(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        }
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
    // ==================== 绘制水面 ====================

    /**
     * 每帧调用：清除画布，重新绘制水体多边形和水面线条。
     */
    private _drawWater() {
        const g = this._graphics;
        if (!g) return;
        g.clear();

        const leftX = this._leftX;
        const rightX = -this._leftX;
        const surfaceY = this._surfaceY;
        const bottomY = this._bottomY;

        const leftWaveY = surfaceY + this._calcWaveOffset(leftX);
        const rightWaveY = surfaceY + this._calcWaveOffset(rightX);

        // ===== 填充水体 =====
        g.fillColor = this.bodyColor;
        g.moveTo(leftX, bottomY);
        g.lineTo(leftX, leftWaveY);
        this._drawSurfaceCurve(g);
        g.lineTo(rightX, bottomY);
        g.close();
        g.fill();

        // ===== 水面线条 =====
        g.strokeColor = this.surfaceColor;
        g.lineWidth = this.lineWidth;
        g.moveTo(leftX, leftWaveY);
        this._drawSurfaceCurve(g);
        g.stroke();
    }

    private _calcWaveOffset(x: number): number {
        if (!this.enableAutoWave) return 0;
        const t = this._elapsedTime;
        const freq = this.autoWaveFrequency;
        const spd = this.autoWaveSpeed;
        const dir = this.autoWaveDirection;
        const amp = this.autoWaveAmplitude;
        return Math.sin(x * freq + t * spd * dir) * amp
             + Math.sin(x * freq * 1.8 + t * spd * 1.4 * dir) * amp * 0.35
             + Math.sin(x * freq * 3.6 + t * spd * 2.2 * dir) * amp * 0.12;
    }

    private _getWaveY(i: number): number {
        return this._getSpringY(i) + this._calcWaveOffset(this._getSpringX(i));
    }

    private _drawSurfaceCurve(g: Graphics) {
        const count = this.springCount;
        if (count < 2) {
            for (let i = 0; i < count; i++) {
                g.lineTo(this._getSpringX(i), this._getWaveY(i));
            }
            return;
        }

        // 左边缘 → 第一个弹簧 → 第一个中点：用曲线过渡
        const firstX = this._getSpringX(0);
        const firstY = this._getWaveY(0);
        const secondX = this._getSpringX(1);
        const secondY = this._getWaveY(1);
        g.quadraticCurveTo(firstX, firstY, (firstX + secondX) / 2, (firstY + secondY) / 2);

        // 中间弹簧：标准贝塞尔曲线
        for (let i = 1; i < count - 1; i++) {
            const cx = this._getSpringX(i);
            const cy = this._getWaveY(i);
            const nx = this._getSpringX(i + 1);
            const ny = this._getWaveY(i + 1);
            g.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
        }

        // 最后一个弹簧 → 右边缘：用曲线过渡
        const lastX = this._getSpringX(count - 1);
        const lastY = this._getWaveY(count - 1);
        const rightX = -this._leftX;
        const rightY = this._surfaceY + this._calcWaveOffset(rightX);
        g.quadraticCurveTo(lastX, lastY, rightX, rightY);
    }

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
    public splash(index: number, velocity: number) {
        if (index >= 0 && index < this.springCount) {
            this._velocities[index] += velocity;
        }
    }
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
        console.log('WaterController: _onBeginContact');
        // 获取碰撞物体的刚体
        const otherBody = otherCollider.node.getComponent(RigidBody2D);
        if (!otherBody) {
            console.error('WaterController: RigidBody2D component not found');
            return;
        }

        // 获取碰撞物体的世界坐标
        const otherWorldPos = otherCollider.node.worldPosition;

        // 将世界坐标转换为水面的本地坐标
        const localPos = this.node.inverseTransformPoint(new Vec3(), otherWorldPos as any);

        // 根据 X 坐标找到最近的弹簧
        const springIndex = this._findNearestSpring(localPos.x);

        // 获取碰撞物体的速度
        const velocity = otherBody.linearVelocity;

        // 施加速度到弹簧（衰减 + 限制幅度）
        const clampedVel = Math.max(
            -this.maxSplashVelocity,
            Math.min(this.maxSplashVelocity, velocity.y * this.splashDamping)
        );

        this.splash(springIndex, clampedVel);
    }

    /**
 * 随机选一个弹簧，施加一个小冲量。
 * 由 schedule 定时调用。
 */
    private _randomSplash() {
        const index = Math.floor(Math.random() * this.springCount);
        this.splash(index, this.randomSplashForce * (Math.random() > 0.5 ? 1 : -1));
    }
}

