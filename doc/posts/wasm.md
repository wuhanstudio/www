WASM 浏览器 / 云服务 / 嵌入式
=========================

> WASM 在浏览器取得了巨大的成功，而 WASM 嵌入式还在画大饼，WASM 云服务略有小成，还在努力。

在 Kubernetes (k8s) 风靡全球之后，KubeCon + CloudNativeCon 也就成为了云服务 (Cloud Service) 领域最大的全球峰会了：每年北美一场，欧洲一场。

从 2023 年开始，一些最受欢迎的云原生应用 (Cloud Native) 在 KubeCon 有了自己的分会场 (Co-Located Events)，例如：**每个 k8s 集群几乎都会部署的 Istio，很受欢迎的 ArgoCD，针对机器学习的 Kubeflow**，还有一些我没用过，但是最近很受欢迎的 Cilium，OpenTofu (Terraform fork)。

![img](https://doc.wuhanstudio.cc/posts/wasmargocd.png)

最近准备参加 KubeCon 2024，发现有个 Cloud Native Wasm Day 专场。我印象中 WASM 最早是提升浏览器性能，后来在嵌入式也有一些应用，但是我还从来没有把 WASM 和 云服务 联系起来过，没想到 WASM 已经和 Rust 共同扩展到 Serverless 领域了。

> 实不相瞒，WASM + Rust + Serverless 仨在一起，总给我一种：还在努力，再等等的感觉。



## 1 WASM 浏览器

曾经浏览器只能运行 JavaScript，一方面 JavaScript 以运行速度慢闻名；另一方面，很多计算相关的库函数都是 C/C++ 编写的，例如 Eigen，OpenCV。如果要在浏览器里面做一些计算、渲染，无法重复利用 C/C++ 函数感觉有点遗憾，重新用 Javascript 写也比较麻烦。

**为了提升浏览器的性能，并重复利用 C/C++ 库函数**，Mozilla 在 2012 年宣布了 Emscripten 编译器，可以把 C/C++ 代码编译成 asm.js，并在 2015 年演示了在浏览器里运行 C/C++ 代码写的游戏，从此也正式有了 Web Assembly，也就是 WASM。

> 从名字来看，汇编语言 (Assembly) 无疑是高效的，把 Web 和 Assembly 组合起来，称之为 WASM，读起来就感觉浏览器的性能就提升了。

比如我们有一段 C 代码：

```
#include <stdio.h>

int main() {
    printf("Hello World\n");
    return 0;
}
```

Emscripten 可以把它编译成 .asm 文件，甚至支持直接输出 html。

```
emcc hello.c -o hello.html
```

这样我们就可以在浏览器里面看到控制台输出了：

![img](https://doc.wuhanstudio.cc/posts/wasmemscripten.png)

自从有了 WASM，浏览器的发展一发不可收拾，其中最过分的要属 AutoCAD 了，直接把他们 30 多年的桌面应用 AutoCAD 移植到了浏览器里面，从此我们可以在浏览器里出图了，这也证明了 Emscripten 已经成熟到可以转换大型桌面程序到浏览器了。

![img](https://doc.wuhanstudio.cc/posts/wasmautocad.png)

**后来，我们开始习惯在浏览器里面运行各种桌面应用了**，例如浏览器里用 MS Word, MS PPT，Photoshop (Photopea)，以及 Unity3D，Unreal 自动导出网页版。

![img](https://doc.wuhanstudio.cc/posts/wasmphotopea.png)



### 1.1 WASM SDL

有人可能会问，浏览器里面显示用的是 Canvas，而桌面应用调用的是 SDL 或者 OpenGL，那显示转换这部分是不是得自己写？毕竟浏览器里可没有 SDL 和 OpenGL 的 API。

其实 **Emscripten 不只是把 C/C++ 转换成 WASM，同时也会转换 SDL / OpenGL 到 HTML 的 Canvas。**当然，我们编译的时候也需要添加额外的选项，原始 C++ SDL 代码也有很多需要注意的细节，可以参考下面链接的文章。

```
emcc example.cpp -o example.html -s USE_SDL=2
```



### 1.2 WASM WebGPU

虽然 Emscripten 成功通过 WASM 在浏览器内运行桌面应用，但浏览器也给 WASM 带来很多限制。例如，WebGL 不能直接调用 GPU 等硬件资源做高效渲染。

随后，**WebGPU 诞生了，从此可以在浏览器内直接调用 GPU 渲染**。为了在 WASM 里调用 WebGPU，现有的解决办法有两个：

- C/C++ 代码：利用 Dawn 做一个桥接，Javascript --> Dawn --> Emscripten --> WASM
- Rust 代码：Rust 的 wgpu 库原生支持 WebGPU，Rust --> LLVM --> WASM。



### 1.3 WASM 内存隔离

**除了 Canvas 渲染 和 GPU 硬件，我们还需要担心文件系统和内存**，毕竟 C 代码里我们可以直接打开、读取一个文件，但是浏览器 JavaScript / WASM 并不能直接访问文件系统。为了解决这个问题，我们可以把文件集成到 WASM 内存里，或者在内存里构建一个虚拟文件系统。

虽然浏览器给 WASM 带来了很多限制，但浏览器也有自带的优势，跨操作系统 (Win, Linux, MacOS)，跨硬件架构 (x64, ARM, RISC-V)，**还有很容易被忽略的内存隔离**：浏览器不同标签页 (Tab) 是完全隔离的，例如打开 YouTube 的标签页，并不会影响 Google 的标签页，而 YouTube 这个标签页也并不知道 Google 标签页的存在，他们的内存互相是完全隔离的。

**在 WASM 看来，就是一串代码 + 一块内存**，它无法访问文件系统，也无法访问其他 WASM 应用的内存。这样互相完全隔离，也就保证了安全性，不禁联想到云服务的虚拟化，还有嵌入式系统的用户态，都非常看重内存隔离和安全性，这也就有了后面 WASM 在 嵌入式 和 云服务 的应用。



### 1.4 WASM Runtime

WASM 在浏览器里面运行的架构，看起来是这样的：

![img](https://doc.wuhanstudio.cc/posts/wasmoverview.png)

> 那么能不能把 WASM 应用到浏览器以外的场景呢？例如云服务和嵌入式。

前面提到，WASM 就是一串代码 + 一块内存，其实并不依赖浏览器，**如果我们把 WASM Runtime 独立出来，那么 WASM 就不必依赖浏览器了**，我们就可以在 嵌入式 和 云服务 领域，充分发挥 WASM 内存隔离的安全性优势了。

另一方面，我们也可以让 C/C++，Rust 以外，更多的编程语言支持 WASM，我们只需要写一个前端解析 Python，Golang 等语言，再交给 LLVM 后端生成 WASM。

这样，**WASM 不仅支持各种语言 (C/C++，Rust，Python，Golang)，也可以在浏览器、嵌入式、云服务，各种环境下运行**。

接下来会介绍 WASM 在 嵌入式 (WAMR) 和 云服务 (Wasmer / Wasmtime) 的运行环境。

![img](https://doc.wuhanstudio.cc/posts/wasmstructure.png)



## 2 WASM 嵌入式

> 为了在浏览器以外运行 .wasm 程序，嵌入式系统需要提供一个 wasm 运行环境 (runtime).



### 2.1 WAMR

现在已经有针对嵌入式的 wasm-micro-runtime 了，简称为 WAMR。除了可以在 Linux，Windows，Android，MacOS 上运行，目前 RTOS 还支持 Zephyr, AliOS-Things, VxWorks, NuttX, RT-Thread, ESP-IDF。

例如 Linux 下我们就可以通过下面的命令执行  .wasm 程序，对于有控制台的 RTOS 而言，例如 Zephyr，RT-Thread，也可以在控制台里执行下面的命令运行 .wasm 。 

```
iwasm <wasm file>
```



### 2.2 WASI

那么问题来了，对嵌入式设备而言，最重要的就是访问硬件，例如 I2C，SPI，UART。但是前面提到，WASM 为了安全性，运行在一个隔离 Sandbox 里，甚至不能直接访问文件系统，在这里只有代码和内存。如果不能访问硬件，WASM 对嵌入式设备来讲，看起来就毫无用处了。

当然，WASM 嵌入式肯定是需要访问硬件的，于是就有了 [WebAssembly System Interface](https://github.com/WebAssembly/WASI)API (WASI) 来定义一些系统相关的 API，帮助 WASM 访问文件系统，IO，I2C，SPI，HTTP，Random，Socket，时钟等资源，然后通过 WASI-SDK 编写代码生成 .wasm 程序，通过嵌入式平台的 WAMR 运行环境执行代码。 

![img](https://doc.wuhanstudio.cc/posts/wasmwasi.png)

使用 WASM-SDK 的好处在于，这样写的嵌入式代码是跨操作系统 (Linux, Windows, MacOS, RTOS)，跨硬件平台的 (x64, ARM, RISC-V)，因为硬件相关的操作 WASI 都做了抽象。



### 2.3 WAT 和 WASM 区别

既然提到了嵌入式，这里顺便介绍一下 WAT (汇编代码) 和 WASM (机器码) 的区别。

> 可能上面一句话已经解释清楚了。

因为 WASM 编译生成的 .wasm 文件是二进制的，类似 .bin 固件，很难直接看懂。

```
0000000: 0061 736d              ; WASM_BINARY_MAGIC
0000004: 0100 0000              ; WASM_BINARY_VERSION
```

所以定义了.wat文本格式，类似 RISC-V 汇编代码，由编译器翻译成 RISC-V 二进制机器码。 

```
(module
  (func $hello (import "" "hello"))
  (func (export "run") (call $hello))
)
```

当然，实际并不太需要手写 .wat文件，一般都是 C/C++ 或者 Rust 编译器输出，完整的 WAT 解释可以参照官方文档。

- [Understanding WebAssembly text format - WebAssembly | MDN](https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format)



### 2.4 真的必要吗？

前面说了很多 WASM 的好处：跨平台、跨硬件、内存隔离、安全性高，但是对嵌入式来讲，真的有必要吗？

> WASM 嵌入式感觉是画了个大饼，但是里面都还是空的。

比如我想尝试在 RT-Thread / Zephyr / Nuttx 上用 WASM C 代码访问 I2C 设备，但是发现 WASM-SDK 现在只集成了 libc，并没有 wasm-i2c, wasm-spi, wasm-io，也找不到相关的例程，只能找到经典的 Hello World 例程：**申请一块内存，向内存里写入一串字符，并打印出来**。

现在 WASM 嵌入式的状况是：还在制定 WASI 接口标准，具体的实现其实还不存在。

那么问题就来了：对嵌入式而言，通常开发者针对具体应用，是精心挑选了芯片型号的（外设，内存，Flash），并不需要刻意去兼容其他的芯片，为什么不直接调用芯片厂家提供的 SDK，而要为了不必要的兼容性，去使用 WASM-SDK 呢？

假如 WASM-SDK 出了问题，从上到下，可能是 WASI 接口定义的问题，可能是 WASM 运行环境在 RTOS 移植的问题，可能是 RTOS 移植这块芯片的问题，也可能是芯片 SDK 的问题，但是这些组件由不同公司、不同组织维护的，为了解决问题可能需要和多方沟通，可能会大大拖慢项目的开发进度。

相比之下，如果直接调用芯片的 SDK，或者 RTOS 的 SDK，出了问题直接找 RTOS 或者芯片厂家就可以了，通常彼此有直接的沟通合作，但是要找 WASM，WASI，WAMR 解决问题，可能就不是那么容易了。

还有非常致命的一点，运行 WAMR 也是需要额外占用 Flash 和 RAM 的：

> Small runtime binary size (~85K for interpreter and ~50K for AOT) and low memory usage.

上面官方文档里说只需要 ~85K 空间，但是对中低端单片机而言，可能一共才只有 64KB-256KB 的 Flash，运行 RTOS 可能还要占用一些空间，结果可能是还没开始写自己的应用，光 RTOS + WAMR 就把资源用完了。

另一方面，如果是考虑 C/C++ 内存安全，嵌入式平台现在也有了 Rust 支持，某些特定芯片的 Rust 支持也比 WASI 更全面。

总体看来，在中低端 Cortex-M 系列芯片上跑 WASM 似乎很不划算，资源不够；中高端的 Cortex-A 系列原本就支持 C/C++，Rust，操作系统也提供用户态隔离，POSIX 的代码移植性也很强，不太有必要 C/C++ --> WASM --> WAMR 折腾一番。

如果再往高端走，就到了云服务的领域了，从 KubeCon 的 WASM 专场来看，可能 WASM + Rust + Serverless 更适合 WASM 未来的发展。



## 3 WASM 云服务

WASM 在云服务的运行环境，现在比较主流的是 wasmer 和 wasmtime，它们都是用 Rust 写的，这也是为什么 WASM 经常和 Rust 一起出现的原因之一，同时出现的还有 Serverless。

### 3.1 Serverless

> 现在云服务为了降低成本，逐渐走向 Serverless 模式。

曾经的云服务，需要向 AWS，Google Cloud，阿里云，买一台服务器虚拟机（例如 Ubuntu），分配一个公网 IP，然后 ssh 登录上去，手动安装软件，搭建 Web App（例如 GitLab，Owncloud）。

后来有了 Docker，我可以把自己的应用打包成一个 Docker Container，上传到 AWS 云服务，告诉 AWS 对应的端口，云服务商就会自动帮我们部署 Docker 应用，返回一个免费域名指向部署好的应用，这个过程中我们不再需要访问 Ubuntu 虚拟机，只需要关心 Docker Container。

再后来，连 Docker Container 都可以由云平台帮忙打包，我们只需要提交 Python，NodeJS，Golang，Rust 代码，云平台会帮忙打包容器，分配虚拟机，部署应用，例如 AWS Lambda 服务。

> Serverless 模式，我们不需要关心虚拟机的存在。

可以看到，无论是上传 Docker Container，还是直接提交代码，**我们都不需要 ssh 到某个服务器**，这也是为什么被称为 Serverless。

### 3.2 Serverless 优缺点

> 这样做的好处在于：便宜。

对于用户来讲，如果买一个 EC2 服务器，只要服务器开机，就收费。但是如果我们用 Serverless，只有在自己的 Container 或者 Lambda Function 被调用的时候，才收费，能节省不少开支。

对于云厂商来讲，一台服务器可以部署好几个 Container，提高了服务器的利用率，收好几份钱。

> 这样做的缺点在于：不灵活。

如果我们买一台云服务器，除了部署应用，偶尔还可以用来做别的事，比如兼职 VPN，测试软件，端口映射等，但是 Serverless 模式我们就只能部署应用了。

另一方面，Serverless 和云厂商是绑定的，例如 AWS Lambda 的一些函数只由 AWS 提供，未来如果迁移到 Google Cloud，阿里云，一些应用需要重写，非常不灵活。

### 3.3 为什么需要 WASM

首先，Rust + WASM 本身就是一个完整的运行环境了，以 wasmtime 为例：

```
$ rustup target add wasm32-wasi
$ rustc hello.rs --target wasm32-wasi

$ wasmtime hello.wasm
Hello, world!
```

这样我们就可以在 wasm 环境里独立运行 Rust 代码了，这种独立运行代码的模式和 Serverless 不谋而合。

另一方面，现在大部分 Serverless 应用，都是 Python 或者 JavaScript 写的，它们启动、运行速度都不够快，为了提升性能，Rust + Wasm + Serverless 很自然地走到了一起。

![img](https://doc.wuhanstudio.cc/posts/wasmwasmer.png)

只不过，Serverless 自己发展得很好，例如 AWS Lambda。Rust + Serverless 在 AWS 的大力宣传下，发展速度也很快。但是 Rust + Serverless + WASM 三个一起就不太行了，比如 wasmer 官网用 Rust 关键词只搜到 37 个软件包，除去 hello-world，tuotrial， 真正用 Rust 编写的成熟 Serverless WASM 应用，并没有几个。


## 总结

WASM 在浏览器取得了巨大的成功，而 WASM 嵌入式还在画大饼，WASM 云服务略有小成，还在努力。
