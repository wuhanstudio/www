Vulkan Compute Shader (GPU 硬件加速)
==================================

> 2025 年 五月 Vulkan 终于发布了第一个稳定版，新的时代又要开启了。

只要提到 GPU 硬件加速，可能很多人第一反应是 CUDA，毕竟 NVIDIA 的 GPU 在深度学习领域的地位，至今仍是不可撼动的。

但是最近在用 ollama 本地跑 LLM 大模型的时候，突然发现我的 Intel GPU 竟然也能提供硬件加速，这就触及到我的知识盲区了。

在了解 Vulkan Compute Shader 之前，我对 GPU 硬件加速的认知基本就是 NVIDIA 显卡 用 CUDA，AMD 显卡用 ROCm，但是 Intel 的 GPU 就很少会提及硬件加速了，而且不同厂家的 GPU 硬件加速代码是不通用的，不能跨平台兼容。

于是我调查了一下 ollama 的硬件加速代码，**想看看它是怎么实现跨平台的 GPU 硬件加速**。后来发现，它是调用的 llama.cpp 开源项目，而这个项目能实现跨平台 GPU 硬件加速的秘密，就是 Vulkan Compute Shader。

在花了一个月时间学习 Vulkan 之后，**现在已经可以写一套 GPU 加速代码，跨平台运行在各大 GPU 了**： Intel, NVIDIA,，AMD，Apple，甚至 ARM 的 Mali GPU 上，感觉打开了新世界的大门。 

![](https://doc.wuhanstudio.cc/posts/vulkan_cs/overview.jpeg)

于是借着这个机会总结了一下现在硬件加速的平台，可以分为 CPU，GPU 和 xPU，其中 CPU 和 GPU 都可以实现跨平台的代码，而 xPU 则是特殊的专用硬件，比如 Google 的 TPU。

- 其中，CPU 的硬件加速可能大家都不陌生，由于 Intel，AMD，ARM，RISC-V 的 CPU 指令集是不兼容的，在 Intel CPU 上编译的程序，并不能在 ARM CPU 上直接运行，但是现在有了 LLVM，只要把代码编译成 LLVM 指令，就可以在不同的 CPU 上跨平台运行。

- 那么问题来了，**GPU 的硬件加速是不是也有这么方便的跨平台指令呢？答案就是 2015 年发布的 SPIR-V**，只要把 GPU 的代码编译成 SPIR-V 指令，就能在不同的 GPU 上运行，而要运行 SPIR-V 指令，就需要用到 Vulkan Compute Shader。

<br/>

# 跨平台 GPU 硬件加速

**2007 年，NVIDIA 发布了 CUDA 计算平台**，从此可以使用 CUDA 来实现并行计算，把数据从 CPU 的内存，复制到 GPU 的显存，就可以调用 GPU 的多核实现并行计算，很快 CUDA 就成了深度学习的业界标准。

然而，垄断是一件非常不好的事情，于是 **AMD 在 2016 发布了 ROCm**，也开始了 GPU 硬件加速之旅，然而毕竟比 NVIDIA 晚了接近 10年，现在用的人还是不算太多。

但是，我不知道的是，**2012 年 OpenGL 4.3 还发布了 Compute Shader**，也是为了实现用 GPU 做并行计算。

![](https://doc.wuhanstudio.cc/posts/vulkan_cs/history.png)

这里可能有人会问：OpenGL 不是用来开发 3D 游戏，渲染 3D 场景的吗？OpenGL 还能用来做硬件加速吗？当然是可以的，熟悉计算机图形学的人 (Computer Graphics) 应该清楚，如果我们要渲染一个 3D 物体，需要给 OpenGL 提供 Vertex Shader 和 Fragment Shader。

> 这里简单介绍一下什么是 Shader （着色器），比如很多人玩游戏的时候，例如下面的黑神话悟空，经常会在游戏启动的时候看见正在进行着色器 (Shader) 编译，这里的 Shader 其实就是运行在 GPU 上的代码。
>
> 但是 Shader 是源代码，我们需要把它编译成能在 GPU 上运行的指令，然而不同 GPU 的指令是不兼容的，所以游戏第一次加载的时候，需要把源代码 Shader 编译成你电脑 GPU 能认识的指令集。
>
> 那么，如果我们电脑从 NVIDIA 显卡，换成了 AMD 显卡，是不是需要重新编译 Shader 呢？那当然是需要的，所以如果你换了一个厂家的显卡，重新进入游戏会发现又要重新编译着色器了。

这里的 Shader 翻译为着色器，是因为一个 3D 物体通常由很多的顶点构成，而 Shader 的主要作用就是计算得到每一个点应该显示什么颜色，并且每一个点的渲染是独立并行的，这就为大规模并行计算提供了可能。

所以，当有人看到 Shader 可以并行给不同顶点计算颜色的时候，就很自然地想到用 Vertex Shader 和 Fragment Shader 来实现并行加速，但是它们本来是用来渲染的，并不是为了计算。所以，2012 年 OpenGL 推出了 Compute Shader 来满足专门为了计算使用的 Shader。

![image-20250531175005093](https://doc.wuhanstudio.cc/posts/vulkan_cs/shader.png)

然而不幸的是，**不同 GPU 的硬件指令是互不兼容的**，每次都要为不同的 GPU 编译 Shader 源码是非常不方便的，而且不同厂家的 Shader 编译器也不一样，**很有可能同一个 Shader 源码，不同厂家的编译器编译成了不同的功能**。于是为了解决兼容的问题，2016 年诞生了 SPIR-V 指令，只要我们都先把 Shader 编码编译成更接近硬件指令的 SPIR-V，这样不同厂家就不容易理解错了。

总结一下，2012 年有了 OpenGL + Compute Shader，2015 年有了跨 GPU 的 SPIR-V 格式，这样我们就可以用 OpenGL 编写跨平台的 GPU 代码了。然而，OpenGL 已经非常老旧了，因为历史原因有很多兼容问题，于是 2016 年还推出了 OpenGL 的替代品 Vulkan，这样我们就可以用全新的 Vulkan + Compute Shader 跨 GPU 并行计算了。

2025 年五月，Vulkan 终于发布了第一个稳定版本，至此，一个新的时代就开始了。

<br/>

# Vulkan 相关的工具

那么问题来了，既然 Vulkan Compute Shader 可以实现跨平台的 GPU 硬件加速，**为什么很多人可能根本没听过 Vulkan 硬件加速呢**？

一个原因是 Vulkan 非常灵活，比如我们用 OpenGL 是不能选择使用哪个 GPU 的，没法直接用 OpenGL 的 API 拿到 GPU 的硬件细节，但是 Vulkan 就可以办到，我们可以用 Vulkan 对 GPU 进行全方面的配置，这也导致 Vulkan 的代码非常长，业界广为流传：**Vulkan 代码，1000 行起步，也只能画个三角形**。

另一个原因是 Vulkan 是用 C/C++ 的，对于深度学习很多用 Python 的人来说，要用 C/C++ 去写几千行代码，这个门槛太高了，望而却步，所以实际深度学习领域 Vulkan并不是那么出名。

当然，前面也提到 Vulkan 是 2025年五月才发布第一个稳定版本，未来 Vulkan 毫无疑问会取代 OpenGL，以后肯定也会有更多深度学习领域的人听说 Vulkan。

> Vulkan 几千行 C/C++ 代码起步可能过于惊悚，所以这里介绍一下能让 Vulkan 用起来更简单的工具。

- [**Kompute**](https://github.com/KomputeProject/kompute): GPU 计算本身的代码是 Compute Shader 实现的，Vulkan 只不过是用来部署 Shader，而 Kompute 隐藏了 Vulkan 底层 API，大大减少了部署 Compute Shader 的代码量。
- [**JAX**](https://github.com/jax-ml/jax)：可以实现 CPU / GPU 跨界硬件加速，CPU 使用 LLVM，GPU 则是 CUDA，ROCm，Metal 都有。 
- [**Taichi**](https://github.com/taichi-dev/taichi)：也是实现 CPU / GPU 异构硬件加速，不过首选 Vulkan 支持。
- [**Slang**](https://github.com/shader-slang/slang)：这是 NVIDIA 官方推出的更高级的 Shader 语言，可以支持自动微分。

<br/>

# 总结

Ollama 借助了 llama.cpp 项目来运行 LLM大模型，而 llama.cpp 使用了 Kompute 这个开源库，来实现 Vulkan Compute Shader 跨平台 GPU 硬件加速。
