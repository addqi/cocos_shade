import { _decorator, Component, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('filmshade')
export class filmshade extends Component {
    @property({ type: Node })
    private targetNode: Node | null = null;

    start() {
        // 确保有目标节点
        if (!this.targetNode) {
            this.targetNode = this.node;
        }
    }

    update(deltaTime: number) {
        // 获取材质
        const sprite = this.targetNode?.getComponent(Sprite);
        const material = sprite?.sharedMaterial;
        if (material) {
            // 更新timeChange属性，实现随时间流动的效果
            const currentTime = material.getProperty('timeChange', 0) as number;
            material.setProperty('timeChange', currentTime + deltaTime);
        }
    }
}


