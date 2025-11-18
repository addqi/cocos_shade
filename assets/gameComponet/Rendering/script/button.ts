import { _decorator, Component, EventTouch, Label, Material, Node } from 'cc';
const { ccclass, property } = _decorator;

// 按钮点击数据接口
export interface ButtonClickData {
    labelText: string;
    material?: Material;
    [key: string]: any; // 可选扩展字段
}

@ccclass('button')
export class button extends Component {
    @property(Material)
    public material: Material = null!;
    
    @property({ type: Node })
    public targetNode: Node = null!;

    // 点击回调函数类型
    private clickCallback: (data: ButtonClickData) => void = null!;

    protected onLoad(): void {
        // 绑定点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onButtonClick, this);
    }

    /**
     * 设置点击回调函数
     */
    public setClickCallback(callback: (data: ButtonClickData) => void): void {
        this.clickCallback = callback;
    }

    /**
     * 按钮点击处理
     */
    private onButtonClick(event: EventTouch): void {
        // 阻止事件冒泡
        event.propagationStopped = true;

        // 获取按钮数据
        const buttonData = this.getButtonData();

        // 调用回调函数
        if (this.clickCallback) {
            this.clickCallback(buttonData);
        }
    }

    /**
     * 获取按钮数据
     */
    private getButtonData(): ButtonClickData {
        // 获取标签文本
        let labelText = "";
        const labelNode = this.node.getChildByName("label");
        if (labelNode) {
            const labelComp = labelNode.getComponent(Label);
            if (labelComp) {
                labelText = labelComp.string;
            }
        }

        // 返回按钮数据
        return {
            labelText: labelText,
            material: this.material
        };
    }

    protected onDestroy(): void {
        // 清理事件监听
        this.node.off(Node.EventType.TOUCH_END, this.onButtonClick, this);
    }
}


