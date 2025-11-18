import { _decorator, Canvas, Component, Material, Node, Sprite, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('bgScript')
export class bgScript extends Component {

    start() {
        const halfSize = 192 / 2;
        const material = this.node.getComponent(Sprite).material;
        const box = this.node.worldPosition;
        material.setProperty('offsetX', box.x - halfSize);
        material.setProperty('offsetY', 720 - box.y - halfSize);
        console.log('offsetX', box.x - halfSize);
        console.log('offsetY', 720 - box.y - halfSize);
    }

    update() {
        let bguv = this.node.getComponent(Sprite).material.getProperty('bgUv');
        console.log('bguv', bguv);
    }
    
}


