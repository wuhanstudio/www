AI for TDTR 探索
========================

> AI for Time-Domain Thermoreflectance (TDTR)

最近随着 LLM 的兴起，原本用在计算机领域的深度学习模型，开始在各个领域掀起一股 **AI for Science** 的热潮，也就是将机器学习的方法应用到传统的自然科学，比如传热、流动、天气预测。

然而，AI 真的是万能钥匙吗？真的所有领域都适合 AI 吗？

在拿到计算机博士学位之前，我学的是热物理。

曾经的本科同学，很多也拿到了热物理的博士学位。于是某位不愿透露姓名的张 \* 同学，希望试试能不能把 AI 应用到 热物理。这位不愿透露姓名的 \* 创 同学又找到了远在东京做实验的 \* 汝磊 同学，打算一起试试能不能用 AI 来优化 传热实验 **TDTR ( Time-Domain Thermoreflectance)**。

<br/>


# TDTR 介绍

这里简单介绍一下 TDTR 实验，它的目的是测量材料的热性质，例如热导率 (Thermal Conductivity)、热容 (Volumetric Heat Capacity)，试验台架看起来是这样的：

[![img]https://doc.wuhanstudio.cc/posts/tdtr_slang/tdtr_exp.png)](https://pmiclab.com/testing-services/thermal-conductivity/time-domain-thermoreflectance-tdtr/)

可能有人会注意到，不是说测量热性质吗？这明显看起来是一个光学台架呀。

没错，**TDTR 就是利用激光来测量材料的热性质**，它可以测量非常薄的材料。一个材料非常薄的时候 (几纳米 nm 到 几微米 um)，相比几厘米厚的同一种材料 (Bulk Material)，它的热性质会发生非常大的变化，所以我们需要一种实验，能测量非常薄的薄膜材料。

TDTR ( Time-Domain Thermoreflectance) 从名字来看，有 Time-Domain 和 Thermoreflectance 两部分，接下来我会分别介绍。

## Thermoreflectance

想要测量非常薄的材料，头疼的地方在于，**微弱的热信号很多时候并不方便直接测量**，所以 TDTR 将热信号转变成了方便测量的光信号：反射率 (Reflectance)，我们可以用 R 表示。
$$
\frac{\Delta R}{R}=C_{TR}\ \Delta T
$$
当温度变化非常小的时候 (<10K)，一个材料表面的反射率 R 的变化和温度变化 $\Delta T$ 是线性相关的，所以我们可以通过测量 $\Delta R$ 来间接测量温度变化 $\Delta T$，这种特性也称为 Thermoreflectance。

![image-20250901183616186](https://doc.wuhanstudio.cc/posts/tdtr_slang/tdtr_exp_1.png)

于是我们就有了一个构想：用一束激光 (Pump Beam) 去加热材料表面，然后用另一束激光 (Probe Beam) 去探测材料表面的反射率，这样就可以通过光信号测量到温度变化了，而且激光的好处是非接触，也不会破坏材料。

## Time Domain

前面提到，我们要用一束激光去加热材料表面，再用另一束激光探测材料表面的响应。

> 这里顺便一提，实际上实验只需要一个激光源，通过 PBS (Polarizing Beam Splitter) 分成两束激光，再用 EOM (Electro Optic Modulator) 调制成需要的频率。

这两束激光之间，需要有一段时间间隔，称为弛豫时间 (relaxation time $\tau_d$)。因为热传递是需要时间的，所以下面这张图 Pump 和 Probe 激光直接有一段时间间隔。

> 两束激光的延迟，可以通过机械结构，改变两条光路的距离，这样两束激光到达材料的时间就有一个延迟了。

![image-20250901185557692](https://doc.wuhanstudio.cc/posts/tdtr_slang/pump_probe.png)

另一方面，**只有在温度变化非常小的时候 (<10K)**，一个材料表面的反射率 R 变化和温度变化 $\Delta T$ 才是线性相关的，所以通常使用正弦的高频激光，作为 Pump 脉冲去加热材料表面，再用一个方波调至的 Probe 激光探测材料对脉冲的响应。

![image-20250901190046697](https://doc.wuhanstudio.cc/posts/tdtr_slang/probe_signal.png)

这样一个高频正弦信号，和一个方波信号叠加，就是最后传感器能检测到的光信号。

![image-20250901190600402](https://doc.wuhanstudio.cc/posts/tdtr_slang/signal_response.png)

但是，只有一组数据是无法拟合的，所以我们需要改变弛豫时间 $\tau_d$，得到一组响应曲线。

由于热性质不同，这样不同材料的响应曲线也是不同的，**所以我们根据响应曲线就能反推出材料的热性质**。

![image-20250901190853752](https://doc.wuhanstudio.cc/posts/tdtr_slang/tdtr_curve.png)

当然，虽然说是 Time Domain，实际上信号处理后面需要傅里叶变化 (Fourier Transform) ，因为激光脉冲是按一定频率持续不断发射的，**所以最后的响应也是一连串脉冲信号的叠加，也就是卷积**。而傅里叶变换之后，在频域进行卷积，可以简化成两个信号的加法，后面也可以看到 GPU 计算都是用的复数 (Complex Number)。

**后面代码可以看到，TDTR 的运算都是包含复数 `a+bj` 的。**

<br/>

# AI for TDTR

那么问题来了，这看起来就是一个傅里叶导热问题，为什么需要 AI 呢？

**确实 TDTR 是有完整的理论模型的**，只要知道实验的激光频率，材料的热特性，我们就可以用理论模型计算得到响应曲线。

比如激光我们可以建模为一个圆形的激光束，在不同时间 $t$，不同半径 $r$ 的激光强度有完整的理论公式：
$$
p_1(r, t)=\frac{2A_1}{\pi\omega^2}\text{exp}(-\frac{2r^2}{\omega_1^2})e^{i\omega_0t}\sum_{n=-\infty}^{\infty}\delta(t-nT_s-t_0)
$$
而接下来的热传导，也遵循傅里叶导热定律：
$$
C\frac{\partial T}{\partial t} = \frac{\eta K_z}{r}\frac{\partial}{\partial r}(r\frac{\partial T}{\partial r}) + K_z\frac{\partial^2T}{\partial z^2}
$$
所以我们可以用理论模型，**从 激光参数 和 材料的热参数，推导出最后的响应曲线**。

> TDTR 完整的理论推导推荐下面的 YouTube 视频，介绍得非常详细。
>
> https://www.youtube.com/playlist?list=PLu90K6-O5kAxjF35cE1jkNp1-WyQDK1Cm

然而问题在于，**材料的热参数是未知的**，这就是 TDTR 实验想要测量的。

- 理论模型：激光参数 + 材料热参数 ==> 响应曲线  (正问题)
- 实际实验：激光参数 + 响应曲线 ==> 材料热参数 (反问题)

所以我们可以看到，**正问题有理论依据非常成熟，但是反问题就没法求解了**。现在很多 AI for Science 都是希望用深度学习去求解反问题。

针对 TDTR，传统方法是用 启发式寻优算法 (Heuristic Search) 去寻找可能的热参数。比如用 模拟退火，蚁群，遗传算法，在众多可能的热参数中寻找，不停地尝试。如果找到一组参数，能和实验的响应曲线拟合上，那就确定材料的热参数了。

那么，现在 LLM 带动 AI 的热潮，能不能用 AI 的方法来解决 TDTR 传热问题呢？

>这半年多，我空闲的时候陆续思考了一些 AI 解决 TDTR 反问题的新思路，在这里总结一下。

![image-20250901202127740](https://doc.wuhanstudio.cc/posts/tdtr_slang/ai_for_tdtr.png)

<br/>

## 方法 1: Surrogate Model

首先，最为常见的操作就是用深度学习的模型，去替代传统的物理传热模型。
$$
y=f(x)
$$
比如上面的函数 $f(x)$ 既可以是理论物理模型，也可以是一个深度学习模型来近似理论模型。

这里就有一个问题了，深度学习模型的拟合能力是非常强的，我们怎么能保证深度学习替代的模型，和物理模型完全一致呢？

于是就诞生了 **PINN (Physics Informed Neural Network)**，其实想法非常直白，就是在深度学习模型训练的时候，在 Loss Function 里面加上一些物理约束：
$$
\text{loss} = \text{loss}_{mse} + \bold{\text{loss}_{physics}}
$$
而常见的物理约束，可以是偏微分方程，因为深度学习求导数是非常容易的。

比如 Navier-Stokes 流体方程：
$$
\nabla \cdot \bold{u}=0
$$
这个等式右边的零约束，就可以加入到 Loss Function 里面。

### 1.1 PINN 正问题

前面提到，TDTR 的正问题非常简单，有成熟的理论模型，但是反问题比较困难。

比如 $y=x^2$ 这个函数，一个 $x$ 对应一个 $y$，和深度学习模型一样都是一输入，一输出。



![y = x^2 - 2](https://mathcentral.uregina.ca/qq/database/qq.09.06/mike1.1.gif)

有的时候正问题，可能都不需要加物理约束就能拟合得很好了。但有的时候模型训练又很容易过拟合，这取决于具体的物理模型，现在还没有一个通用的方法。

> 针对 TDTR，就是我们训练一个深度学习模型，输入是激光和材料的热参数，输出则是 TDTR 的响应曲线。

用 AI 拟合正问题的好处是：

- 深度学习模型，比传统物理模型求解快，因为传统数值方法离散后迭代，通常不好用 GPU 加速。
- 保护理论模型知识产权，比如不想让别人知道物理模型的细节，可以训练一个深度学习代理模型，输入输出都是一样的，这样就不用直接提供原始物理模型了。

### 1.2 PINN 反问题

用深度学习拟合反问题就比较麻烦了，因为反问题很多时候会有多对一的问题。

比如 $y=x^2$ 的反问题，$x=\pm\sqrt{y}$ 有2个解，这个时候我们就需要加物理约束，告诉深度学习模型我们想拟合的是 $x=\sqrt y$ 还是 $x = -\sqrt y$。

![image-20250901203157058](https://doc.wuhanstudio.cc/posts/tdtr_slang/multi.png)

> 针对 TDTR，就是用深度学习去训练一个模型，输入是 TDTR 的响应曲线 和 激光参数，输出则是想要测量的材料热参数。

用 AI 拟合反问题的好处是一步到位，原本理论模型无法解决的反问题，现在可以直接求解了。

<br/>

## 方法 2: Differentiable TDTR

另一个思路是，传统方法的缺点在于：

- 物理模型不可微分，所以只能用启发式优化，例如遗传算法、模拟退火来搜寻；
- 物理模型计算太慢，导致寻优需要花费非常多的时间。

**那么我们能不能直接正面解决这2个问题呢？**而不是绕弯到去用 AI for Science 再训练一个模型。

下面的解决方法可能是 TDTR 特有的，因为我发现 TDTR 计算最花费时间的其实是下面的矩阵乘法，而这个计算过程本身就是可微，也可以用 GPU 去加速的，所以并不是一定要用 AI 深度学习模型。

```
q = np.zeros((ksize, omegasize, Nlayer), dtype=complex)
b = np.zeros((ksize, omegasize, Nlayer), dtype=complex)
c = np.zeros((ksize, omegasize, Nlayer), dtype=complex)

for index in range(Nlayer):
    # 这个其实就是把列向量复制扩展成矩阵
    q[:, :, index] = np.sqrt(np.dot(np.ones((ksize, 1)), 1j * omega / alpha[0, index]) + np.dot(k2, np.ones((1, omegasize))))
    # 下面两行，都是矩阵的 element-wise 乘法，可以用 GPU 加速
    b[:, :, index] = np.multiply(np.divide(-1, kappa[0, index] * q[:, :, index]), np.tanh(q[:, :, index] * d[0, index]))
    c[:, :, index] = np.multiply(-kappa[0, index] * q[:, :, index], np.tanh(q[:, :, index] * d[0, index]))
```

> 当然，也可能是我只是想借助 TDTR 去学一下 JAX 和 Slang Shader。


### 2.1 TDTR 自动微分 (JAX)

深度学习模型的一个好处就是可微，现在除了深度学习模型，很多 numpy 线性代数的运算，也可以用自动微分 (Automatic Differentiation) 来保存梯度了，其中非常有名的就是 JAX。

很多 LLM 为了在 GPU 上高性能训练，也是用 JAX 而不是 Pytorch 实现的。而 JAX 除了自动微分，也可以自动 GPU加速，**但是这个的前提是需要提前知道所有的输入输出，和中间变量的计算图**，比如我们不能动态地创造一个矩阵，并且也不能直接替换迭代矩阵里的数值。

比如：

```
# 这是不行的
q[0] = 3
```

需要更改成：

```
q.at[0].set(3)
```

除了这些问题外，几乎可以直接用 JAX 来替换 Numpy，入门门槛非常低。

于是用 JAX 重新实现 TDTR 的正模型，其实就是提前初始化好各种变量，然后把矩阵更新 (In-place Update) 全部替换成 `array.at[].set()` 函数就可以了，接下来 JAX 会帮助我们保存梯度信息和 GPU 加速。

```
for index in range(Nlayer):
    q = q.at[:, :, index].set( jnp.sqrt(jnp.dot(jnp.ones((ksize, 1)), 1j * omega / alpha[0, index]) + jnp.dot(k2, jnp.ones((1, omegasize)))) )
    b = b.at[:, :, index].set( jnp.multiply(jnp.divide(-1, kappa[0, index] * q[:, :, index]), jnp.tanh(q[:, :, index] * d[0, index])) )
    c = c.at[:, :, index].set( jnp.multiply(-kappa[0, index] * q[:, :, index], jnp.tanh(q[:, :, index] * d[0, index])) )
```

而有了梯度之后，我们也不需要老老实实完全用遗传算法、模拟退火来寻优了，可以结合 JAX 的梯度信息，加速寻优的过程。

### 2.2 TDTR 硬件加速 (Slang Shader)

除了 JAX 提供 **自动微分** 和 **GPU 硬件加速**外，NVIDIA 最近也推出了全新的 **Slang Shader** 来在 GPU 上实现自动微分。

> Slang 是在微软 DirectX 的 HLSL (High-level Shader Language) 上扩展而来的，如果熟悉 Unity3D 游戏开发，用过 HLSL 可能会发现 Slang 非常容易上手。

但是 Slang Shader 的门槛可能相比 JAX 要高一些，在学习 Slang 之前，强烈建议至少熟悉 OpenGL 或者 Vulkan 的 Compute Shader：

- [Vulkan Compute Shader (GPU 硬件加速)](https://doc.wuhanstudio.cc/posts/vulkan_cs.html)

那么问题来啦，你可能会问既然是 Compute Shader，为什么不直接用 GLSL 而非要去用 Slang 呢？

除了 Slang 提供自动微分外，它还提供类似 C++ 的扩展，比如运算符重载，还可以给 struct 添加函数，这对于 TDTR 的复数操作非常友好，没有运算符重载，如果用 GLSL 实现复数运算可能要写一堆函数了。

另一个好处是，Slang 可以直接用 Python，不像 OpenGL 和 Vulkan 主要面对 C/C++ 用户，所以可以直接用 Python 初始化 GPU 并且加载一个 Compute Shader：

```
import slangpy as spy

# 初始化 GPU
device = spy.Device(
    type=spy.DeviceType.vulkan,
    enable_print=True
)

print(device)

# 加载 Compute Shader
program = device.load_program("tdtr.slang", ["main"])
kernel = device.create_compute_kernel(program)
```

当然，既然是 GPU 编程，还是需要手动初始化 buffer，把数据从 CPU 内存复制到 GPU 内存，最后把 GPU 的运算结果转换回 CPU 的 Numpy 矩阵：

```
# Input buffers
buffer_k2 = device.create_buffer(
    element_count=ksize,
    struct_type=kernel.reflection.main.k2,
    usage=spy.BufferUsage.shader_resource,
    data=k2[:, 0].astype(np.float32),
)

...

# Output buffer
buffer_b_re = device.create_buffer(
    element_count=(ksize*omegasize*(1+N_layers)),
    struct_type=kernel.reflection.main.b_re,
    usage=spy.BufferUsage.unordered_access,
)

buffer_b_im = device.create_buffer(
    element_count=(ksize*omegasize*(1+N_layers)),
    struct_type=kernel.reflection.main.b_im,
    usage=spy.BufferUsage.unordered_access,
)

...

# Dispatch the computing
kernel.dispatch(
    thread_count=[101, 1, 1], 
    k2=buffer_k2, 
    ...
    b_re=buffer_b_re,
    b_im=buffer_b_im,
    c_re=buffer_c_re,
    c_im=buffer_c_im
)
```



最后就是用 Slang Shader 实现的 TDTR，其实就是用 Slang 实现了复数的运算，并且加速了矩阵运算：

```
import sgl.device.print;

struct Complex
{
    float re;
    float im;

    __init(float real, float imaginary ) { re = real; im = imaginary;}
}

Complex operator+(Complex a, Complex b)
{
    return Complex(a.re + b.re, a.im + b.im);
}

Complex operator-(Complex a, Complex b)
{
    return Complex(a.re - b.re, a.im - b.im);
}

Complex operator*(Complex a, Complex b)
{
    return Complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

Complex operator/(Complex a, Complex b)
{
    return Complex( (a.re*b.re + a.im*b.im) / (b.re*b.re + b.im*b.im), (-a.re*b.im + a.im*b.re) / (b.re*b.re + b.im*b.im));
}

Complex operator*(float b, Complex a)
{
    return Complex(a.re * b, a.im * b);
}

Complex operator*(Complex a, float b)
{
    return Complex(a.re * b, a.im * b);
}

// Square Root for Complex Number
// https://proofwiki.org/wiki/Square_Root_of_Complex_Number_in_Cartesian_Form
Complex sqrt(Complex c)
{
    float z = sqrt( pow(c.re, 2) + pow(c.im, 2) );
    float c_re = sqrt( (z + c.re) / 2 );
    float c_im = sign(c.im) * sqrt( (z - c.re) / 2 );

    return Complex(c_re, c_im);
}

// tanh for Complex Number
// Formulation 3: https://proofwiki.org/wiki/Hyperbolic_Tangent_of_Complex_Number
Complex tanh(Complex c)
{
    float tanh_re = (tanh(c.re) + tanh(c.re)*pow(tanh(c.im), 2)) / (1 + pow(tanh(c.re), 2) * pow(tanh(c.im), 2));
    float tanh_im = (tanh(c.im) - tanh(c.im)*pow(tanh(c.re), 2)) / (1 + pow(tanh(c.re), 2) * pow(tanh(c.im), 2));

    return Complex(tanh_re, tanh_im);
}

[shader("compute")]
[numthreads(64, 1, 1)]
void main(
    uint3 tid: SV_DispatchThreadID,
    StructuredBuffer<float> k2,
    StructuredBuffer<float> alpha,
    StructuredBuffer<float> kappa,
    StructuredBuffer<float> d,
    StructuredBuffer<float> omega,
    RWStructuredBuffer<float> b_re,
    RWStructuredBuffer<float> b_im,
    RWStructuredBuffer<float> c_re,
    RWStructuredBuffer<float> c_im
)
{
    if (tid.x > 100) return;

    uint id_l = tid.x;
    uint ksize = k2.getCount();
    uint omegasize = omega.getCount();

    for(uint id_k = 0; id_k < ksize; id_k++)
        for(uint id_o = 0; id_o < omegasize; id_o++)
        {
            float q_re = k2[id_k];
            float q_im = omega[id_o] / alpha[id_l];

            Complex q = Complex(q_re, q_im);
    
            Complex q_sqrt = sqrt(q);
    
            float kp = kappa[id_l]; 
            float dl = d[id_l];

            Complex c1 = tanh(q_sqrt * dl);
            Complex c2 = -1.0 * kp * q_sqrt;

            Complex b = c1 / c2;
            Complex c = c1 * c2;

            b_re[id_k * omegasize * 101 + id_o * 101 + id_l] = b.re;
            b_im[id_k * omegasize * 101 + id_o * 101 + id_l] = b.im;

            c_re[id_k * omegasize * 101 + id_o * 101 + id_l] = c.re;
            c_im[id_k * omegasize * 101 + id_o * 101 + id_l] = c.im;
        }
}
```



# 总结

AI for Science 还是一个非常新的研究方向，很多文章里其实都是用的非常简单、基础的深度学习模型。

另一方面，并不是所有的物理模型都是适合 AI 的，比如 TDTR 其实物理模型本身就是可微分的，也可以用 GPU 加速，并不是一定需要用深度学习去替代这个物理模型。

最后，下面几个方向其实都是做的类似的研究：

- AI for Science: 非常大的话题，实际更偏向商业化应用和宣传；
- Scientific Machine Learning (SciML): 用机器学习的方法，去解决科学问题；
- Differentiable Physics: 让传统的物理模型可微，比如让傅里叶变化可微分，更偏理论研究。
