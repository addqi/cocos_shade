import { _decorator, Canvas, Component, Material, Node, Sprite, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('bgScript')
export class bgScript extends Component {

    start() {
        // 移除未使用的offsetX和offsetY属性设置
        // 这些属性在着色器中并未使用
        console.log('小地图脚本启动');
    }

    update() {
        // 移除未使用的bgUv属性获取
        // console.log('bguv', bguv);
    }
    
}


