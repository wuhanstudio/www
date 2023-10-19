# Rust 嵌入式开发 STM32 & RISC-V

## Preface

最近 Mozilla 的 Rust 和 Google 的 Golang 两门新语言非常受关注。

![](https://doc.wuhanstudio.cc/posts/erust/go.jpg)

不过 Golang 除了 Docker 这个标志性的项目，在服务端配合 gRPC 也已经应用非常广泛了，可以说已经是相当很成熟了；然而相比之下 Rust 还是旁观的多，实际用的少，微软和 Facebook 也都只是宣称实验性地尝试用 Rust 实现一些新功能，毕竟 Facebook 也在研发自己的操作系统。

Rust 的官方主页标语就是 reliable and efficient，吉祥物也是硬壳的螃蟹，自然就有人想到把 Rust 应用到安全可靠的嵌入式。

![](https://doc.wuhanstudio.cc/posts/erust/rust.jpg)

嵌入式的特点就在于指令集 (ISA) 特别多，如果一门语言想要应用到嵌入式，首先自然是得能编译出兼容不同指令集的程序。Rust 早期编译器是 rustc 提供代理 (proxy)，将编译任务传递到后端实际的编译器来进行编译，这样就可以编译出不同指令集的程序。但是在 Rust 1.28 之后，终于拥抱 LLVM，Golang 和 Swift 也都是积极拥抱 LLVM（LLVM 势不可挡）。LLVM 特点就是在于提供抽象的 IR (intermediate representation)，先将源码翻译为 LLVM IR，再由后端生成不同指令集的程序，效率高，还能兼容不同平台。

![](https://doc.wuhanstudio.cc/posts/erust/llvm.png)

所以在 Rust 积极拥抱 LLVM 之后，在嵌入式领域开发更加方便了，接下来就介绍一下如何在 STM32 (Cortex M3) 和 GD32 (RISC-V) 上用 Rust 开发。

## Prerequisites

首先自然是得搭建好 Rust 的开发环境，这在 Rust 的[主页](https://www.rust-lang.org/tools/install)上已经介绍得很详细了，安装也很简单。

不过值得注意的是，在 Windows 下安装 Rust 会提示需要安装 Visual Studio，其实这并不是必须的，前面提到了 Rust 已经集成了 LLVM，所以本身就可以直接编译，不需要而外的编译器。当然，有些 rust 组件安装还是需要自己电脑上有编译器的，比如后面会提到的 [cargo-binutils](https://github.com/rust-embedded/cargo-binutils)。不过在 Windows 安装 Rust 的时候暂且跳过 Visual Studio 也是完全没有问题的 ;)

如果安装好 Rust 的开发环境，重启一下控制台，应当能运行 rustup （工具链管理），rustc （编译器），cargo （软件包管理）。

## Introduction

这里简单介绍一下 Rust 的组成。

首先 rustc 是编译器，可以用 rustc 编译 rust 程序 （*.rs）生成二进制文件。但是一个个文件手动 rustc 编译是非常辛苦的，所以 rust 提供了 cargo 软件包管理器，可以 cargo new 生成项目，cargo build 编译，cargo run 运行，非常方便。

rustup 这个工具是用来管理 rust 工具链的，前面提到 rust 集成了 LLVM，但是程序要想在嵌入式环境运行，除了编译器还需要一个运行环境（Runtime），而 rustup target list 就可以看到不同的目标环境，这些环境会提供编译好的 rust-std，例如我安装好了 riscv 和 armv7 的环境。

```
$ rustup target list
riscv32imac-unknown-none-elf (installed)
riscv32imc-unknown-none-elf
riscv64gc-unknown-linux-gnu
riscv64gc-unknown-none-elf
riscv64imac-unknown-none-elf
s390x-unknown-linux-gnu
sparc64-unknown-linux-gnu
sparcv9-sun-solaris
thumbv6m-none-eabi
thumbv7em-none-eabi
thumbv7em-none-eabihf
thumbv7m-none-eabi (installed)

```

rustup 还可以列出当前主机的编译器，我默认用的是 mysis 提供的 gnu-gcc：

```
$ rustup toolchain list
stable-x86_64-pc-windows-gnu (default)
```

rustup 也可以用来安装新的 rust 组件，例如 cargo 软件包管理器， LLVM 工具：

```
$ rustup component list
cargo-x86_64-pc-windows-gnu (installed)
llvm-tools-preview-x86_64-pc-windows-gnu (installed)
```

所以 rus 组成常用的就是 rustup 管理工具链，cargo 开发项目。

## Rust on STM32F103

首先介绍一下如何在 STM32F103 上用 Rust 驱动经典的 SSD1306。

![](https://doc.wuhanstudio.cc/posts/erust/u8g2.webp)

这里用到的是 [ssd1306](https://crates.io/crates/ssd1306) 这个 crate （Rust 的软件包叫 crate，发布在 crate.io）。

比如我们以这个 crate 的例程为例，首先把源码下载下来：

```
$ git clone https://github.com/jamwaffles/ssd1306
```

简单介绍一下 rust 项目的组成，Cargo.toml 这个文件里定义了项目的依赖，定义格式很简单，例如这里定义了项目依赖 cortex-m 的 runtime：

```
[dev-dependencies]
cortex-m = "0.6.2"
cortex-m-rt = "0.6.12"
```

在 Cargo.toml 里面定义好依赖之后，编译的时候会自动下载依赖，非常方便。

在编译之前，首先当然是要确定目标开发板的硬件，比如这里要告诉 rust 我们希望生成 stm32f103 的目标（thumbv7em-none-eabi），而这个是在项目根目录 .cargo/config 文件里指定的，当然也可以编译的时候用命令行参数传进去 --target=thumbv7em-none-eabi

```
[build]
target = "thumbv7m-none-eabi"
```

虽然现在指定了 MCU 的指令集架构，但是我们并没有告诉编译器开发板的 Flash，RAM 资源，为了让 rust 知道该如何链接，和 Keil 一样需要指定链接脚本，打开 memory.x 就可以看到了，这里我把 Flash 和 RAM 改成了 stm32f103rct6 的配置，默认是 stm32f103c8t6.

```
/* Linker script for the STM32F103RCT6 */
MEMORY
{
  FLASH : ORIGIN = 0x08000000, LENGTH = 256K
  RAM : ORIGIN = 0x20000000, LENGTH = 48K
}
```

在编译之前，之前提到过需要为目标开发板提供预编译的运行环境 (runtime)：

```
$ rustup target add thumbv7m-none-eabi
```

终于可以开始编译了，例如编译例程的 image_i2c：

```
$ cargo build --example image_i2c --release
```

前面提到，也可以在这里指定目标 MCU 的指令集：

```
$ cargo build --example image_i2c --release --target=thumbv7m-none-eabi
```

编译完成就可以看到在 target/thumbv7m-none-eabi/release/examples 下多了，但是这个文件有 1M 多大小，很明显是包含了调试信息的 elf 文件，我们需要用 objcopy 生成最后上传到开发板的 bin 文件。

这里我用的是 arm-none-eabi-objcopy，可以在 [GNU-Toolchain](https://developer.arm.com/tools-and-software/open-source-software/developer-tools/gnu-toolchain/gnu-rm/downloads) 下载。

```
$ arm-none-eabi-objcopy -O binary target/thumbv7m-none-eabi/release/examples/image_i2c image_i2c.bin
```

最后把生成的 bin 文件用 st-link 或者其他工具上传到开发板就可以了 ;)

## Rust on RISC-V

在 risc-v 的开发板上用 rust 开发其实也差不多，这里顺便以 GD32F103 的 Longan Naon 开发板为例，介绍一下 rust 依赖的组成。

![](https://doc.wuhanstudio.cc/posts/erust/longan.png)

大致是这样的组成：

- rust 处理器依赖 [riscv](https://github.com/rust-embedded/riscv)

- rust 运行环境 [riscv-rt](https://github.com/rust-embedded/riscv-rt)

- 嵌入式 HAL 依赖 [embedded-hal](https://crates.io/crates/embedded-hal)

- MCU 的 HAL 实现 [gd32vf103xx-hal](https://github.com/riscv-rust/gd32vf103xx-hal)

- MCU 的 bsp 支持 [longan-nano](https://github.com/riscv-rust/longan-nano)

不过这些都已经写好了，GD32F103的 Bumblebee 内核是 华中科技大学 对面芯来科技设计的，而 GD32F103 的 RUST HAL 实现刚好是华科本科生写的，恰好我也是华科的研究生，太巧了 ;)

所以用 rust 开发嵌入式不需要重复实现相同的功能，使用开源的 crate 软件包就可以了。

比如我们先下载下来项目：

```
$ git clone https://github.com/riscv-rust/longan-nano/
```

项目结构和之前是一模一样的，这里就不重复介绍了，和之前一样，编译前需要添加 risc-v 的运行环境：

```
$ rustup target add riscv32imac-unknown-none-elf
```

接下来我们就可以编译了：

```
$ cargo build --release --example ferris --features lcd
```

同样的，编译之后我们需要用 objcopy 生成 bin 文件：

```
$ riscv-none-embed-objcopy -O binary target/riscv32imac-unknown-none-elf/release/examples/ferris ferris.bin
```

熟悉了这样的流程之后会发现其实挺顺手的，这里的工具链我是用的芯来科技官网的 [RISC-V GNU Tool](https://www.nucleisys.com/download.php)。

最后自然是用 dfu-utils 把 bin 文件上传到开发板了。

![](https://doc.wuhanstudio.cc/posts/erust/rust.webp)

## Issues

最后这里有一个没有解决的小问题，上面编译虽然用的都是 rust 工具链，但是连接其实还是用到了 arm-gcc 和 riscv-gcc。

rust 其实提供了 [cargo-binutils](https://github.com/rust-embedded/cargo-binutils) 可以调用 LLVM 的 objcopy 来生成最终的二进制文件。

```
$ cargo install cargo-binutils
$ rustup component add llvm-tools-preview
```

不过我用这个工具生成的 bin 传到开发板里没有正常运行，不知道有没有办法解决。

```
$ cargo objcopy --target riscv32imac-unknown-none-elf --example ferris --release --features=lcd -- -O binary ferris.bin
```

**2023-01-10 更新：现在使用 cargo objcopy 生成的 bin 可以正常运行了，不再需要单独安装 gcc 工具链。**

## 参考资料

- Rust LLVM https://docs.rust-embedded.org/embedonomicon/compiler-support.html
- Rust 嵌入式教程 https://rust-embedded.github.io/book/
- Rust 嵌入式列表 https://github.com/rust-embedded/awesome-embedded-rust