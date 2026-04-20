import { _decorator, Camera, Color, Component, Graphics, Node, Sprite, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LightningController')
export class LightningController extends Component {
    /**闪电起点节点  */
    @property({ type: Node, tooltip: '闪电起点节点（不设置则使用自身位置）' })
    startNode: Node | null = null;
    /**闪电终点节点 */
    @property({ type: Node, tooltip: '闪电终点节点' })
    endNode: Node | null = null;


    /**分段递归次数，每 +1 线段数翻倍 */
    // @property({ range: [1, 8, 1], slide: true, tooltip: '分段递归次数，每 +1 线段数翻倍' })
    subdivision: number = 5;

    /**混乱系数，越大闪电弯曲越剧烈 */
    // @property({ range: [0.01, 0.5, 0.01], slide: true, tooltip: '混乱系数，越大闪电弯曲越剧烈' })
    chaosFactor: number = 0.15;

    /**同时绘制的闪电条数 */
    // @property({ range: [1, 5, 1], slide: true, tooltip: '同时绘制的闪电条数' })
    boltCount: number = 2;

    /**闪电核心颜色（建议白色或浅蓝色） */
    @property({ tooltip: '闪电核心颜色（建议白色或浅蓝色）' })
    coreColor: Color = new Color(220, 230, 255, 255);

    /**闪电辉光颜色（建议半透明蓝紫色） */
    @property({ tooltip: '闪电辉光颜色（建议半透明蓝紫色）' })
    glowColor: Color = new Color(100, 150, 255, 80);

    /**核心线宽 */
    // @property({ range: [1, 6, 0.5], slide: true, tooltip: '核心线宽' })
    coreWidth: number = 10;

    /**辉光线宽 */
    // @property({ range: [4, 30, 1], slide: true, tooltip: '辉光线宽' })
    glowWidth: number = 12;

    /**闪烁间隔（秒），越小闪得越快 */
    // @property({ range: [0.02, 0.3, 0.01], slide: true, tooltip: '闪烁间隔（秒），越小闪得越快' })
    flashInterval: number = 0.05;

    /**持续时间（秒），0 = 无限 */
    // @property({ range: [0, 100, 0.1], slide: true, tooltip: '持续时间（秒），0 = 无限' })
    duration: number = 0;

    /**运行后自动开始闪电 */
    // @property({ tooltip: '运行后自动开始闪电' })
    autoStart: boolean = true;
    /**闪电绘制器 */
    private _graphics: Graphics;
    /**闪电轨迹点 */
    private _bolts: Vec2[][] = [];
    /**闪烁计时器 */
    private _flashTimer: number = 0;
    /**持续计时器 */
    private _durationTimer: number = 0;
    /**是否激活 */
    private _isActive: boolean = false;
    /** 复用的临时 Vec3，避免每帧 new */
    private _tempVec3: Vec3 = new Vec3()


    protected onLoad(): void {
        this._graphics = this.getComponent(Graphics);
    }

    start() {
        this._regenerateBolts();
        this._drawBolts();
    }


    update(dt: number) {
        // if (!this._isActive) return;
    
        // // 计时器累加
        // this._flashTimer += dt;
    
        // // 到达闪烁间隔 → 重新生成 + 重新绘制
        // if (this._flashTimer >= this.flashInterval) {
        //     this._flashTimer = 0;
        //     this._regenerateBolts();
        //     this._drawBolts();
        // }
    
        // // 持续时间检查（duration > 0 时生效）
        // if (this.duration > 0) {
        //     this._durationTimer += dt;
        //     if (this._durationTimer >= this.duration) {
        //         this.stopLightning();
        //     }
        // }
    }

    private _getLocalPos(targetNode: Node): Vec2 {
        const worldPos = targetNode.getWorldPosition().clone();
        this.node.inverseTransformPoint(this._tempVec3, worldPos);
        return new Vec2(this._tempVec3.x, this._tempVec3.y);
    }
    /**生成闪电轨迹 */
    private _regenerateBolts() {
        const startPos = this._getLocalPos(this.startNode);
        const endPos = this._getLocalPos(this.endNode);
        this._bolts = [];
        for (let b = 0; b < this.boltCount; b++) {
            this._bolts.push(this._generateBolt(startPos, endPos));
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
                    (seg.s.x + seg.e.x) / 2,
                    (seg.s.y + seg.e.y) / 2
                )
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

    /**
    * 用 Graphics 画一条折线路径。
    * 单一职责：只负责"画"，不关心"画什么"。
    * @param g 绘制器
    * @param points 路径点
    * @param color 颜色
    * @param width 线宽
    */
    private _strokePath(g: Graphics, points: Vec2[], color: Color, width: number) {
        g.strokeColor = color;
        g.lineWidth = width;
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            g.lineTo(points[i].x, points[i].y);
        }
        g.stroke();
    }
    /**绘制所有闪电 */
    private _drawBolts() {
        const g = this._graphics;
        if (!g) {
            console.error('Graphics 组件未找到');
            return;
        }
        g.clear();
        for (const bolt of this._bolts) {
            // this._strokePath(g, bolt, this.glowColor, this.glowWidth);
            this._strokePath(g, bolt, this.coreColor, this.coreWidth);
        }
    }

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
}



