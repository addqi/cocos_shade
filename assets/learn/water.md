此教程结合了多教程的优点，集百家之长，精炼了此类2D水做法，包含交互产生及传播波浪的原理、优化性能的方法、利用shaderGraph制作动态波浪的思路等等内容。如果你也是一位富有梦想且热爱学习的人，那么这个教程一定很适合你。
制作思路
首先，众所周知当一滴水滴在水面时，它会掀起一阵波澜，并且“波”还会往四周扩散。观察到这个现象后，我们要如何在unity中模拟出来呢？
将这个现象转换为平面可以把水面的”线“看作由许多的点组成，像健身时甩大绳一样，一个点往上走，那他和周围的点就形成了突起；移动的点再带动周围的点，突起的部分就会扩大；当点移动到最高的位置并且往回走，原来位置突起就会复原，而“波”也就往两边传播了。
知道了原理，那么我们就要实现：当物体碰到点时，点移动；当点移动到极限时，点往回走；并且点应当还要逐渐回归平衡。这个像什么？这不就是弹簧嘛，也就是说我们需要做的是由一堆弹簧组成的线，那么让我们从制作一个弹簧开始吧。

WaterSpring脚本
此脚本为我们水的单个弹簧脚本。为了模拟弹簧，我们需要利用胡克定律的公式—— F=-kx计算弹簧的拉力，为了弹簧会回归原点，我们还需要计算阻尼力——F = -cv。
为了实现弹簧的弹动，我们要知道弹簧当前的移动速度，首先可以先计算力，设置height和target_height变量，记录物体当前位置和起始位置，从而计算出x（位移差），即可算出阻尼力和拉力。然后根据推导公式——v=v0+（t/m）·F合，得出当前的速度。最后由Δx=v·t即可算出下一帧的位移，加到当前位置就实现了弹簧的弹动了。将这些代码写入公有的WaveSpringUpdate(float springStiffness,float dampening)方法中，为什么要这样呢？可以看到我们的k（弹性系数）和c（阻尼系数）是由外部传入的，这样可以通过一个总的弹簧控制脚本WaterShapeController统一调整这些参数，在调试的时候更方便。
那么为了实现弹簧与周围的弹簧的联系，给其他弹簧传播力，这部分将在WaterShapeController脚本的UPdateSpings()方法中统一控制，具体在此脚本看该方法的讲解。

在实现了传播力后，模拟弹簧部分就结束了，接下来要通过SpriteShapeController组件的特性实现画面的效果。首先，在此脚本就是要将弹簧的位置和SpriteShapeController对应的点联系起来。这里只需获得组件中的Spline，并且调用其内置的GetPosition和SetPosition方法根据对应的索引更新位置即可。索引通过自身在父物体中的序号+1获取（+1跳过边界点）。
然后是检测物体入水，此处我使用了OnCollisionEnter2D方法，检测当物体与弹簧碰撞时他的速度，并且加上降低摆动幅度和限制最大摆动幅度的参数即可（不限制的话水可能会飞起来）。

最后别忘了初始化弹簧就行，使用公有的方法，随后和WaveSpringUpdate方法一样在WaterShapeController脚本中统一调用即可。
using UnityEngine;
using UnityEngine.U2D;

[ExecuteAlways]
public class WaterSpring : MonoBehaviour
{
    [Header("单个弹簧参数")]
    [SerializeField][Tooltip("Y轴降低摆动幅度的参数")] private int VlimitY = 50; //Y轴降低摆动幅度的参数
    [SerializeField][Tooltip("X轴降低摆动幅度的参数")] private int VlimitX = 50; //X轴降低摆动幅度的参数
    [SerializeField][Tooltip("限制最大摆动幅度的参数")] private int Vlimit = 5; //限制最大摆动幅度的参数
    [SerializeField][Tooltip("当前点在Spline中的索引位置")] private int waveIndex; // 当前点在Spline中的索引位置
    private SpriteShapeController spriteShapeController;// 关联的水体形状控制器

    [Header("弹簧相关变量")]
    [Tooltip("当前点的垂直速度")] public float Yvelocity = 0; //当前点的垂直速度
    [Tooltip("当前点垂直的受力")] public float Yforce = 0; //当前点垂直的受力
    [Tooltip("当前点的实际高度")] public float Yheight = 0; // 当前点的实际高度
    [SerializeField][Tooltip("水面静止时的高度")] private float Ytarget_height = 0; // 目标高度（水面静止时的高度）
    [Tooltip("当前点的水平速度")] public float Xvelocity = 0; //当前点的水平速度
    [Tooltip("当前点水平的受力")] public float Xforce = 0; //当前点水平的受力
    [Tooltip("当前点的实际水平位置")] public float Xheight = 0; // 当前点的实际水平位置
    [SerializeField][Tooltip("水面静止时的水平位置")] private float Xtarget_height = 0; // 目标水平位置（水面静止时的水平位置）

    #region 初始化
    // 初始化弹簧
    public void Init(SpriteShapeController ssc)
    {
        var i = transform.GetSiblingIndex(); // 获取在父物体中的序号
        waveIndex = i + 1; // 计算在Spline中的索引（+1跳过左边界点）
        spriteShapeController = ssc;

        Yvelocity = 0; // 初始化物理状态
        Yheight = transform.localPosition.y;
        Ytarget_height = Yheight; // 初始目标高度=当前位置

        Xvelocity = 0;
        Xheight = transform.localPosition.x;
        Xtarget_height = Xheight; // 初始目标水平位置=当前水平位置
    }
    #endregion

    #region 物理更新
    // 更新弹簧物理状态
    public void WaveSpringUpdate(float springStiffness,float dampening)
    {
        Yheight = transform.localPosition.y; // 获取当前Y轴位置作为高度
        Xheight = transform.localPosition.x; // 获取当前X轴位置作为水平位置

        var y1 = Ytarget_height - Yheight; // 计算与目标高度的偏差
        var x1 = Xtarget_height - Xheight; // 计算与目标水平位置的偏差
        var lossY = -dampening * Yvelocity; // 计算Y轴阻尼力（与速度方向相反）
        var lossX = -dampening * Xvelocity; // 计算X轴阻尼力

        Yforce = springStiffness * y1 + lossY; // 计算Y轴合力：胡克定律 + 阻尼力
        Xforce = springStiffness * x1 + lossX; // 计算X轴合力
        Yvelocity += Yforce; // 更新Y轴速度（省略了质量项，相当于质量=1）
        Xvelocity += Xforce; // 更新X轴速度

        // 应用速度改变位置
        Vector3 pos = transform.localPosition;
        pos.y += Yvelocity;
        pos.x += Xvelocity;
        transform.localPosition = pos;
    }

    // 将弹簧位置更新到水体Spline的点
    public void WavePointUpdate()
    {
        if (spriteShapeController != null)
        {
            Spline waterSpline = spriteShapeController.spline;
            if (waveIndex < waterSpline.GetPointCount()) //防止当重新生成弹簧点的时候空索引
            {

                Vector3 wavePosition = waterSpline.GetPosition(waveIndex);
                // 只更新Y坐标，保持XZ不变
                waterSpline.SetPosition(waveIndex, new Vector3(
                    transform.localPosition.x,
                    transform.localPosition.y,
                    wavePosition.z));
            }
        }
    }
    #endregion

    #region 物体入水碰撞检测
    // 碰撞检测（物体入水时）
    private void OnCollisionEnter2D(Collision2D collision)
    {
        //if (collision.gameObject.CompareTag("Words")) 自行更改tag
        //{
            // 使用TryGetComponent避免无效的GetComponent调用
            if (collision.rigidbody.TryGetComponent<Rigidbody2D>(out var rb))
            {
                var speed = rb.velocity;
    
                // 根据物体速度添加扰动（限制幅度）
                Yvelocity += Mathf.Clamp(speed.y / VlimitY, -Vlimit, Vlimit);
                Xvelocity += Mathf.Clamp(speed.x / VlimitX, -Vlimit, Vlimit);
            }
        //}
    }
    #endregion
}

WaterShapeController脚本
私有的UPdateSpings()波浪传播计算方法讲解：一个弹簧带动其他弹簧移动的本质，可以看作为此弹簧与周围弹簧有高度差时，周围弹簧根据此高度差产生传播力从而被带动。因此我们先定义个长度为弹簧总数的float类型数组，用于保存传播力。然后用循环遍历所有弹簧，分别计算当前弹簧对左右两边的传播力并保存到数组。全部计算完毕后，将传播力遍历应用到各弹簧的速度即可。

在完成了弹簧的制作后，就到了对SpriteShapeController组件的Spline点的生成了，毕竟不可能一个一个点设置嘛。首先编写生成点的私有的SetWaves()方法，在其中获取Spline组件以及要生成的波浪点数量WavesCount，然后使用内置的RemovePointAt方法移除除边界的旧点，再计算波浪点需要的间距，随后以左边界为起点按间距插入点，并且使用贝塞尔曲线模式（这里左右的边界点要手动设置切线模式，否则显示会有问题）。最后设置所有切线的长度，防止太长出现奇怪的问题。
现在只是设置完了Spline点，还没有加上弹簧，所以要编写使用私有的CreateSprings()方法创建弹簧组件。首先重置弹簧点列表springs，然后生成弹簧预制体wavePointPref到对应父级wavePoints及位置并调用其初始化方法。最后还需将其添加进弹簧点列表，为上文的UPdateSpings()传播方法等使用。
弹簧也配置好了还差点什么呢？使用私有的Smoothen()方法平滑Spline点，如果不平滑的话它就是一段一段效果。在这里我们要做的是为其设置左右的切线，所以先获取该点与左右两点的位置（除去端点），然后根据水的张力tension计算一个切线长度，再计算切线方向并使用Unity工具计算出切线，最后应用即可。
这里使用FixedUpdate()物理更新所有弹簧物理的物理效果。

自此所有的基础部分就完成了，现在已经有了较好的2D水的效果了，但是我们还可以再改进一些地方，比如加上间断泛起的水花、自动流动的波浪等效果。
制作间断泛起的水花的效果：要实现这个效果，可以通过让单个弹簧跳动一下模拟，编写一个私有的Splash(int i, float speed)方法，通过传入弹簧的索引和速度大小，给对应弹簧施加速度。再用私有的RandomSplash（）方法，通过其生成随机数并调用Splash()方法实现跳动。最后在SetWaves()方法中使用内置的InvokeRepeating（）方法实现游戏开始时启动间断泛起的水花，并在每次调用前使用CancelInvoke（）方法取消间断调用方法防止同时开启多个浮动。
制作自动流动的波浪的效果：这里通过ShaderGraph的方式制作，制作过程简要看WaveShader部分。写完shader后编写私有的SetWaveMove（）方法用于初始化shader参数和材质。首先获取SpriteShapeRenderer组件，通过属性块传递数据，这里的1代表获取的是边缘材质（查看组件简介），我们只将制作的材质赋予边缘材质以防止出现奇怪的问题。随后将设置好的参数 传入属性块并应用，在SetWaves()方法中调用即完成了自动流动的波浪的效果。

自此全网最细的Unity 2D交互水制作完成，接下来前往下文学习在这两脚本中使用到的性能优化的小妙招，以及此效果在游戏内的配置（包括对物体浮力的实现）。
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.U2D;

[ExecuteAlways]
public class WaterShapeController : MonoBehaviour
{
    [Header("整体弹簧参数")]
    [SerializeField][Tooltip("弹簧刚度：越大弹簧弹力越大 液体越硬")] private float springStiffness = 0.1f; // 弹簧刚度
    [SerializeField][Tooltip("阻尼系数：越大停下越快 液体越硬")] private float dampening = 0.05f; // 阻尼系数
    [Tooltip("波浪传播系数：越大对两边点的高度变化影响越大")] public float spread = 0.006f; // 波浪传播系数
    [SerializeField][Tooltip("表面张力：越大曲线越直")] private float tension = 0.33f; //表面张力
    [Range(1,100)][SerializeField][Tooltip("波浪点数量")]private int WavesCount = 6; // 波浪点数量
    [SerializeField][Tooltip("所有弹簧点列表")] private List<WaterSpring> springs = new(); // 所有弹簧点列表

    [Header("波浪参数")]
    [SerializeField][Tooltip("是否开启自流动")] private bool isWaveSelf; // 是否开启自流动
    [SerializeField][Tooltip("波浪材质")] private Material material; //波浪材质
    [SerializeField][Tooltip("波浪移动速度")][Range(0, 10)] private float Speed = 1; //波浪移动速度;
    [SerializeField][Tooltip("波浪数量")][Range(0, 20)] private float Count = 0.75f; //波浪数量;
    [SerializeField][Tooltip("波浪高度")][Range(0,0.5f)] private float Size = 0.15f; //波浪高度;
    [SerializeField][Tooltip("波浪方向")][Range(-1, 1)] private float Direction = 1; //波浪方向;
    [SerializeField][Tooltip("是否开启随机浮动")] private bool isRandomSplash; // 是否开启随机浮动
    [SerializeField][Tooltip("随机浮动大小")][Range(0.01f, 0.1f)] private float RandomSplashForce = 0.01f; // 随机浮动大小
    [SerializeField][Tooltip("随机浮动频率")][Range(0.1f, 2)] private float RandomSplashtime = 0.1f; // 随机浮动频率

    [Header("生成设置")]
    [SerializeField][Tooltip("波浪点预制体")] private GameObject wavePointPref; // 波浪点预制体
    [SerializeField][Tooltip("波浪点父物体")] private GameObject wavePoints; // 波浪点父物体
    [SerializeField][Tooltip("水体控制器")] private SpriteShapeController spriteShapeController; // 水体控制器

    private int CorsnersCount = 2; // 边界固定点数（左右各1）
    private float spacingPerWave; //波浪点间距
    private bool flag;


    #region 初始化
    // 编辑器模式下的更新
    private void OnValidate()
    {
        StartCoroutine(CreateWave()); // 参数变化时重建波浪
    }

    // 重建波浪协程
    IEnumerator CreateWave()
    {
        // 删除旧波浪点
        foreach (Transform chlid in wavePoints.transform)
        {
            StartCoroutine(Destroy(chlid.gameObject));
        }
        yield return null; // 等待一帧
        SetWaves(); // 重建波浪
        yield return null;
    }

    // 安全销毁对象协程
    IEnumerator Destroy(GameObject go)
    {
        yield return null;
        DestroyImmediate(go);
    }

    // 设置波浪点（重建Spline）
    private void SetWaves()
    {
        if (spriteShapeController == null) //获取组件
            spriteShapeController = GetComponent<SpriteShapeController>();

        Spline waterSpline = spriteShapeController.spline; //获取组件

        int waterPointsCount = waterSpline.GetPointCount(); //获取点总数

        // 移除旧波浪点（保留左右边界）
        for (int i = CorsnersCount; i < waterPointsCount - CorsnersCount; i++)
        {
            waterSpline.RemovePointAt(CorsnersCount); //由2开始,下边界不改变
        }

        // 获取左右边界位置
        Vector3 waterTopLeftCorner = waterSpline.GetPosition(1);
        Vector3 waterTopRightCorner = waterSpline.GetPosition(2);
        float waterWidth = waterTopRightCorner.x - waterTopLeftCorner.x; //计算总宽度

        // 计算波浪点间距
        spacingPerWave = waterWidth / (WavesCount + 1); //（波浪点+端点-1=线段数）

        // 插入新波浪点
        for (int i = WavesCount; i > 0; i--)
        {
            int index = CorsnersCount; // 插入位置（左边界后）

            // 计算点X位置（均匀分布） 以左边界起始
            float xPosition = waterTopLeftCorner.x + (spacingPerWave * i);
            //只改变x位置
            Vector3 wavePoint = new Vector3(xPosition, waterTopLeftCorner.y, waterTopLeftCorner.z);
            
            // 插入并配置Spline点
            waterSpline.InsertPointAt(index, wavePoint); //设置位置
            waterSpline.SetCorner(index, false); // 设为曲线点（非角点）
            waterSpline.SetTangentMode(index, ShapeTangentMode.Continuous); // 连续切线模式
        }

        for (int i = waterSpline.GetPointCount()-1; i >= 0; i--)
        {
            waterSpline.SetHeight(i, 0.01f); // 设置所有点切线手柄长度
        }

        CreateSprings(waterSpline); // 创建弹簧组件

        if (isWaveSelf)
            SetWaveMove(); //应用波浪参数

        if (isRandomSplash)
        {
            CancelInvoke(nameof(RandomSplash)); //值改变时，取消随机浮动
            InvokeRepeating(nameof(RandomSplash),0, RandomSplashtime); //启动随机浮动
        }
    }

    // 创建弹簧组件
    private void CreateSprings(Spline waterSpline)
    {
        springs = new(); // 重置列表

        for (int i = 1; i <= WavesCount + 2; i++)
        {
        
            Smoothen(waterSpline,i); // 平滑该点
        
            GameObject wavePoint = Instantiate(wavePointPref, wavePoints.transform, false); // 实例化波浪点
            wavePoint.transform.localPosition = waterSpline.GetPosition(i); //设置位置到对应点
        
            // 初始化弹簧组件
            WaterSpring waterSpring = wavePoint.GetComponent<WaterSpring>();
            waterSpring.Init(spriteShapeController);
            springs.Add(waterSpring);
        }
    }

    // 平滑Spline点（调整切线）
    private void Smoothen(Spline waterSpline, int index)
    {
        Vector3 position = waterSpline.GetPosition(index); //获取点位置
        Vector3 positionPrev = position; //初始化前一个点位置
        Vector3 positionNexv = position; //初始化后一个点位置

        // 获取相邻点位置
        if (index > 1) //若未过左边界
            positionPrev = waterSpline.GetPosition(index - 1);
        if (index - 1 <= WavesCount) //若未过右边界
            positionNexv = waterSpline.GetPosition(index + 1);

        Vector3 forward = gameObject.transform.forward;

        // 计算切线缩放因子
        float scale = Mathf.Min(
            (positionNexv - position).magnitude,
            (positionPrev - position).magnitude
            ) * tension;// 使用张力计算切线长度

        // 计算切线方向
        Vector3 leftTangent = (positionPrev - position).normalized * scale;
        Vector3 rightTangent = (positionNexv - position).normalized * scale;

        // 使用Unity工具计算更平滑的切线
        SplineUtility.CalculateTangents(position, positionPrev, positionNexv,
            forward, scale, out rightTangent, out leftTangent);

        // 应用切线
        waterSpline.SetLeftTangent(index, leftTangent);
        waterSpline.SetRightTangent(index, rightTangent);
    }

    private void SetWaveMove() //应用波浪参数
    {
        SpriteShapeRenderer spriteShapeRenderer = GetComponent<SpriteShapeRenderer>();

        // 创建材质实例
        if (spriteShapeRenderer != null && material != null)
        {
            MaterialPropertyBlock propertyBlock = new MaterialPropertyBlock(); //通过属性块传递数据，减少内存占用
            spriteShapeRenderer.GetPropertyBlock(propertyBlock, 1); //获取属性块

            propertyBlock.SetFloat("_Speed",Speed); //设置参数
            propertyBlock.SetFloat("_Count",Count);
            propertyBlock.SetFloat("_Size",Size);
            propertyBlock.SetFloat("_Direction",Direction);

            spriteShapeRenderer.SetPropertyBlock(propertyBlock, 1); //传递属性块
        }
    }

    #endregion

    #region 物理更新
    // 物理更新
    private void FixedUpdate()
    {
        // 更新所有弹簧物理
        for (int i = 0; i < springs.Count; i++)
        {
            // 更新弹簧位置
            springs[i].WaveSpringUpdate(springStiffness,dampening);
            springs[i].WavePointUpdate(); // 更新Spline位置
        
        }

        UPdateSpings(); // 处理波浪传播
    }

    // 波浪传播计算
    private void UPdateSpings()
    {
    
        int count = springs.Count;
    
        float[] forceDeltasY = new float[count]; // Y轴传播力
        float[] forceDeltasX = new float[count]; // X轴传播力
    
        // 第一遍：计算传播力
        for (int i = 0; i < count; i++)
        {
            // 向左传播
            if (i > 0)
            {
                //传播力 = 传播系数 乘 高度差/位移差
                float deltaY = spread * (springs[i].Yheight - springs[i - 1].Yheight);
                forceDeltasY[i - 1] += deltaY;
                float deltaX = spread * (spacingPerWave - (springs[i].Xheight - springs[i - 1].Xheight)); // 减去间隔，防止无限拉伸
                forceDeltasX[i - 1] += deltaX;
            }
            // 向右传播
            if (i < springs.Count - 1)
            {
                float deltaY = spread * (springs[i].Yheight - springs[i + 1].Yheight);
                forceDeltasY[i + 1] += deltaY;
                float deltaX = spread * (spacingPerWave + (springs[i].Xheight - springs[i + 1].Xheight));
                forceDeltasX[i + 1] += deltaX;
            }
        }
    
        // 第二遍：统一应用速度变化
        for (int i = 0; i < count; i++)
        {
            springs[i].Yvelocity += forceDeltasY[i];
            springs[i].Xvelocity += forceDeltasX[i];
        }
        
    }

    #endregion
    private void RandomSplash() //随机浮动函数
    {
        Splash(UnityEngine.Random.Range(1, WavesCount), RandomSplashForce);
    }

    // 手动在指定位置制造波浪
    private void Splash(int i, float speed)
    {
        if (i >= 0 && i < springs.Count)
        {
            springs[i].Yvelocity += speed;
        }
    }

}

Sprite Unlit Shader Graph：WaveShader
此为波浪自流动效果的实现shader，详见B站视频：
参数：
MainTex ：Texture2D，目前纯占位符
Speed = 1 模式：Slider 范围：(0, 10)   //波浪移动速度
Count = 0.75f 模式：Slider 范围：(0, 20) //波浪数量
Size = 0.15f 模式：Slider 范围：(0,0.5f) //波浪高度
Direction= 1 模式：Slider 范围：(-1, 1) //波浪方向

对节点的简单解释：“波浪设置” 模块，在这里使用Time节点和相乘后的Speed及Direction参数相乘，实现控制流速和流动方向的效果。将Position的R值与其相加，实现X轴上位移效果。Count参数与其相乘，实现“波”在一个方向的拉伸，也就是控制了波浪的数量。将其分别连接用Size参数控制了起伏高低的正反Sine节点，实现不间断的波浪效果（如果觉得不间断太挤了可以去掉一个Sine节点和其连接的节点）。
“分离 UV” 模块，将UV的G值分离开，然后和上一模块的值分别相乘，实现UV在Y轴上的移动。随后使用Clamp节点限制范围防止纹理映射的异常，再相加在一起。
“应用至坐标” 模块，将Position位置节点的G值分离，并与上一模块的值相加，然后重新合并，得到新的顶点位置，然后传递给Vertex 着色器的顶点位置，实现波浪效果。
这里材质应该也要简单配置一下，否则可能会有问题。

节点：
[图片]


SpriteShapeController组件简介
SpriteShapeController可以定义与控制，负责创建、编辑和管理基于样条(Spline)的 2D 形状。点击下图中的Edit Spline即可编辑点，可以改变点的切线模式等。在生成了点后，使用SpriteShapeRenderer组件可以按照其规则显示出来。如此就可以生成水面、地形等内容。
[图片]

性能优化的小妙招
在WaterSpring脚本中，应用速度改变位置处，减少对transform.localPosition的多次访问，可以避免重复计算位置值。因此没有写成：
// 优化前：
var y = transform.localPosition.y;
transform.localPosition = new Vector3(transform.localPosition.x,
                                    y + velocity,
                                    transform.localPosition.z);
在碰撞检测处，使用 TryGetComponent可以避免无效的组件获取，还可以直接使用 collision.rigidbody 访问刚体。

在WaterShapeController脚本中，物理更新处，用for循环替代foreach减少GC分配。不用写成：
// 优化前：
foreach (WaterSpring waterSpringComponent in springs)
{
    // 更新弹簧位置
    waterSpringComponent.WaveSpringUpdate(springStiffness,dampening);
    waterSpringComponent.WavePointUpdate(); // 更新Spline位置

}
在间断泛起的水花处，使用InvokeRepeating间接调用的方法代替计时器(Update)和协程(Coroutine)可以实现最低的内存占用和CPU耗时，并且无需如协程的GC分配。

这里用到的大概就是这些，还可以使用对象池管理波浪点，减少对Spline点的更新频率等等方法，小改动有时也能造成大优化。
游戏内配置

关于两脚本的配置如下图：WaterShapeController脚本中，将制作的shader材质配置到材质部分，并且配置“生成设置”部分的内容，其余参数看需求调整即可（材质还需手动配置到边缘材质）。WaterSpring脚本中，只需配置“单个弹簧参数”的内容。并且注意水和弹簧在场景中的配置即可。
[图片]
[图片]

在水物体中，使用这两个组件可以实现实时生成碰撞箱，并且产生浮力的效果，非常的简单（碰撞箱中要勾选是触发器，和由效果器使用）。在SpriteShapeController组件中，需要配置Profile文件，没有的部分新建一个就行。在SpriteShapeRenderer中注意要使用遮罩，因为启动自动流动的波浪效果后水的下边缘也会有波浪，但是一直不知道怎么在shader解决，所以使用遮罩遮遮瑕。
[图片]
[图片]

遮罩只需要创建一个2D sprite遮罩对象，更改遮罩图片等参数，并且设置为水的子物体，遮掉下面的部分即可。
[图片]

如果碰到了任何问题，欢迎留言，会尽快更改
