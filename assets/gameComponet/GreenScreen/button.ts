import { _decorator, Component, Material, Sprite, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Button')
export class Button extends Component {

    @property(Sprite)
    public sprite: Sprite = null!;

    @property(Material)
    public greenScreenMaterial: Material = null!;

    private originalMaterial: Material = null!;
    private isGreen = false;

    onLoad() {
        // 记录原始材质（非常重要）
        this.originalMaterial = this.sprite.getMaterial(0);

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart() {

        if (this.isGreen) {
            // 切回原材质
            this.sprite.setMaterial(this.originalMaterial, 0);
        } else {
            // 切换到绿幕材质
            this.sprite.setMaterial(this.greenScreenMaterial, 0);
        }

        this.isGreen = !this.isGreen;
    }
}
