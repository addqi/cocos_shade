import { _decorator, Button, Component, EventTouch, Label, Material, Node, Sprite, UITransform } from 'cc';
import { button, ButtonClickData } from './button';
const { ccclass, property } = _decorator;

@ccclass('buttoncontrol')
export class buttoncontrol extends Component {
    @property(Node)
    selectListNode: Node = null;
    @property(Sprite)
    public sprite: Sprite = null!;

    /**初始的文本 */
    private initLabelText: string = "";
    private initMaterial: Material = null!;

    protected onLoad(): void {
        this.initLabelText = this.node.getChildByName("label").getComponent(Label).string;
        this.selectListNode.active = false;
        this.initMaterial = this.sprite.sharedMaterial;
        
        // 排列选择列表
        this.sortSelectList(this.selectListNode);
        
        // 为所有按钮设置点击回调
        this.setupButtonCallbacks();
    }

    update(deltaTime: number) {
        console.log("selectListNode.active是:", this.selectListNode.active);
    }

    /**
     * 设置所有按钮的点击回调
     */
    private setupButtonCallbacks(): void {
        // 主按钮点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onMainButtonClick, this);

        // 选择列表中的按钮点击回调
        this.selectListNode.children.forEach(child => {
            const btnComp = child.getComponent(button);
            if (btnComp) {
                btnComp.setClickCallback(this.onOptionButtonClick.bind(this));
            }
        });
    }

    /**
     * 主按钮点击处理
     */
    private onMainButtonClick(): void {
        if (this.selectListNode.active) {
            this.selectListNode.active = false;
        } else {
            this.selectListNode.active = true;
        }
    }

    /**
     * 选项按钮点击回调
     */
    private onOptionButtonClick(data: ButtonClickData): void {
        // 修改当前按钮的label
        if (data.labelText === "") {
            this.node.getChildByName("label").getComponent(Label).string = this.initLabelText;
        } else {
            this.node.getChildByName("label").getComponent(Label).string = data.labelText;
        }

        // 关闭选择列表
        this.selectListNode.active = false;

        // 设置材质
        if (data.material) {
            this.sprite.setMaterial(data.material, 0);
        } else {
            this.sprite.setMaterial(this.initMaterial, 0);
        }
    }

    /*** 排列选择列表*/
    sortSelectList(parent: Node): void {
        let curY = 0;
        parent.children.forEach(child => {
            if (curY != 0) {
                curY += child.getComponent(UITransform).contentSize.height / 2;
            }
            child.setPosition(0, curY, 0);
            curY += child.getComponent(UITransform).contentSize.height / 2;
        });
    }

    protected onDestroy(): void {
        // 清理事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onMainButtonClick, this);
    }
}


