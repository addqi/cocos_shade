import { _decorator, Component, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('bgScript')
export class bgScript extends Component {
    
    @property({ type: Node })
    private cameraNode: Node | null = null;
    
    private isFirstFrame = true;

    start() {
        console.log('小地图脚本启动');
        
        // 延迟一帧开始渲染，避免第一帧的反馈循环
        this.scheduleOnce(() => {
            this.isFirstFrame = false;
        }, 0);
    }

    update(deltaTime: number) {
        // 在第一帧跳过渲染，避免反馈循环
        if (this.isFirstFrame) {
            return;
        }
        
        // 可以在这里添加其他逻辑
        // 例如：动态更新材质属性等
    }
    
}


