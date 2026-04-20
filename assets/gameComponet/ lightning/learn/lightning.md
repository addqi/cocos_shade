# 动态闪电效果教程

## 效果概述

从一个点到另一个点释放闪电，闪电路径随机生成、不断闪烁，看起来像真实的电弧放电。

```
    ● 起点
    │\
    │ \
    │  ╲
    │   ╱  ← 随机锯齿路径
    │  ╱
    │ ╲
    │  ╲
    ● 终点
```

## 核心算法：中点位移（Midpoint Displacement）

整个闪电效果的灵魂就是一个算法——**中点位移**：

1. 从起点到终点画一条直线
2. 取中点，沿**垂直于线段方向**随机偏移
3. 一条线段变成两条
4. 对每条新线段重复上述操作
5. 重复 N 次，得到 2^N 条锯齿线段 → 闪电

每次偏移量减半，远处粗糙、近处精细，这是**分形**的特征。

## 参考来源

- Unity 版原文：[稀土掘金 - 萧然CS](https://juejin.cn/post/7089731918995931172)
- 本教程将其改写为 **Cocos Creator + TypeScript** 版本

## Unity vs Cocos Creator 对照

| 概念 | Unity | Cocos Creator |
|------|-------|---------------|
| 画线组件 | LineRenderer | **Graphics** 组件 |
| 定时刷新 | Coroutine + WaitForSeconds | **update + 计时器** |
| 材质动画 | Material.mainTextureOffset | **多层绘制**（辉光+核心） |
| 向量类型 | Vector3 | **Vec2**（2D 足够） |
| 垂直方向 | Quaternion.AngleAxis | **(dx,dy)→(-dy,dx)** |
| 随机数 | System.Random | **Math.random()** |
| 语言 | C# | **TypeScript** |

## 最终架构

```
Lightning (Node)
├── LightningController.ts   ← 唯一脚本：生成 + 绘制 + 动画
├── Graphics                  ← 内置组件：画闪电线条
│
├── StartPoint (子节点)        ← 闪电起点
└── EndPoint (子节点)          ← 闪电终点
```

一个节点、一个脚本、一个组件。没有预制体，没有 Shader，没有多余抽象。

## 教程目录

| 步骤 | 内容 | 你会学到 |
|------|------|----------|
| Step 01 | 理解原理与项目搭建 | 中点位移算法原理、创建节点结构 |
| Step 02 | 数据结构与初始化 | Inspector 属性、内部状态、坐标转换 |
| Step 03 | 中点位移算法 | 核心算法实现、2D 垂直方向计算 |
| Step 04 | 用 Graphics 绘制闪电 | Graphics API、首次看到闪电 |
| Step 05 | 闪烁动画与辉光效果 | 定时器、多层绘制、多条闪电 |
| Step 06 | 完整代码与调参指南 | 最终代码汇总、参数调节手册 |
