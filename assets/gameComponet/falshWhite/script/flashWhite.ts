import { _decorator, Component, Material, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

enum FlashState {
    None=0,
    /*** 淡入*/
    fadeIn = 1,
    /*** 淡出*/
    fadeOut = 2,
}

@ccclass('flashWhite')
export class flashWhite extends Component {
    @property(Sprite)
    public sprite:Sprite;
    /*** 材质*/
    private material:Material;
    private flashState:FlashState=FlashState.None;
    private curFlashPercent:number=0;
    private targetFlashPercent:number=1;
    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_START,this.onTouchStart,this);
    }
    start() {
        this.material=this.sprite.sharedMaterial;
    }

    update(deltaTime: number) {
        switch(this.flashState){
            case FlashState.fadeIn:
                if(this.curFlashPercent>=this.targetFlashPercent){
                    this.flashState=FlashState.fadeOut;
                    this.curFlashPercent=this.targetFlashPercent;
                }else{
                    this.curFlashPercent+=deltaTime*5;
                    this.changeFlashPercent(this.curFlashPercent);
                }
                break;
            case FlashState.fadeOut:
                if(this.curFlashPercent<=0){
                    this.flashState=FlashState.None;
                    this.curFlashPercent=0;
                    this.changeFlashPercent(0);
                }else{
                    this.curFlashPercent-=deltaTime*5;
                    this.changeFlashPercent(this.curFlashPercent);
                }
                break;
        }
    }
    onTouchStart(): void {
        this.flashState=FlashState.fadeIn;
        this.changeFlashPercent(0);
    }
    private changeFlashPercent(percent:number): void {
        this.material.setProperty("mixPercent",percent);
    }
}


