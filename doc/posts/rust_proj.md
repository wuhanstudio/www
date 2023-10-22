创建 Rust 嵌入式项目 (RISC-V)
========================

四年前 (2019 年)，以内存安全 (memory-safe) 闻名的 Rust 语言，最大的特点是：围观的人多，使用的人少；永远在学习 Rust 的路上，学习过程中又持续被劝退。

特别是在嵌入式领域，大家都在想象 (envision) 一个 Rust 替代 C/C++ 的未来，但是项目真要完全用 Rust 替代，走起来一步一个坑，可能 Rust 项目框架还没搭起来，就重新投入了 C 的怀抱。

如今已经是 2023 年，实际使用 Rust 的项目越来越多，例如服务器后端、数据库、游戏引擎；另一方面，Rust 也正式成为 Linux 内核官方接受 (**officially accepted**) 的语言；嵌入式领域 Rust 支持的开发板也越来越多。于是最近又重新尝试，看看创建一个 Rust 嵌入式项目会不会变得很轻松。  

这篇文章以 GD32VF103 Start 开发板为例 （当然，Longan Nano 也是用的同一款芯片），创建一个 Rust 经典的 blinky，又名点灯项目。最终创建的项目在 Win / Linux / MacOS 上都可以一行命令 cargo build 自动安装依赖、编译，并通过 cargo objcopy 生成最终的固件，**不再需要单独安装 risc-v gcc 工具链**。

![GD32VF103 Start 开发板](https://doc.wuhanstudio.cc/posts/rust_proj/gd32.png)

## 0. TLDR;

如果不想一步步尝试，直接看到最后的结果，这篇文章使用到的全部命令和代码都在这个 github 仓库里：

[Github] A minimal rust embedded project for RISC-V MCU.github.com/wuhanstudio/gd32vf103-rust-blinky

```
$ git clone https://github.com/wuhanstudio/gd32vf103-rust-blinky
$ cd gd32vf103-rust-blinky

$ cargo build --release
$ cargo objcopy --target riscv32imac-unknown-none-elf --release -- -O binary firmware.bin
```

这样就会生成 firmware.bin 可以用 [GD-Link Programmer 或者 dfu-utils](https://www.gd32mcu.com/cn/download/7?kw=) 上传到开发板。

## 1. 安装 Rust

Rust 的安装和几年前一样，依旧很轻松，[Rust 官网](https://www.rust-lang.org/) 提供了不同操作系统的安装软件包。

```
$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

安装完成后，可以查看 Rust 版本。

```
$ rustc --version
rustc 1.68.0-nightly (3020239de 2023-01-09)

$ cargo version
cargo 1.68.0-nightly (8c460b223 2023-01-04)
```

## 2. 添加  RISC-V 支持

前面提到，现在虽然不需要单独安装 RISC-V GCC 工具链，但默认的 Rust 只支持 x64。因此，我们还是需要添加 RISC-V 的支持。

```
$ rustup target add riscv32imac-unknown-none-elf 

$ cargo install cargo-binutils
$ rustup component add llvm-tools-preview
```

可以看到，Rust 可以使用 LLVM 生成最终的二进制文件。

## 3. 创建 Rust 嵌入式项目

我们首先创建一个默认的 hello world 项目：

```
$ cargo new gd32vf103-rust-blinky
```

这样会自动创建下面的文件结构：

```
.
├── Cargo.toml
├── .gitignore
└── src
    └── main.rs
```

可以看到 Cargo 默认生成的项目自带了 git 支持 (.gitignore)，我们可以直接进入创建的目录用 cargo run 执行程序，但是这样生成的可执行程序默认是 x64 的，我们需要生成 riscv-non-embedded 的格式。

```
$ cargo run
    Finished dev [unoptimized + debuginfo] target(s) in 0.00s
     Running `target\debug\gd32vf103-rust-blinky`
Hello, world!
```

为了生成 RISC-V 嵌入式的固件，我们需要创建一个 .cargo 目录，并在里面修改 cargo 的默认配置，文件结构看起来是这样：

```
.
├── Cargo.toml
├── .gitignore
├── src
    └── main.rs
├── .cargo
    └── config
└── memory-c8.x
```

其中.cargo/config 的文件内容：

```
[target.riscv32imac-unknown-none-elf]
rustflags = [
  "-C", "link-arg=-Tmemory-c8.x",
  "-C", "link-arg=-Tlink.x",
]

[build]
target = "riscv32imac-unknown-none-elf"
```

这个配置文件告诉 cargo 生成我们第二步添加的 riscv32imac-unknown-none-elf 格式固件，并且按照 memory-c8.x 进行链接。

其中 memory-c8.x 的文件内容定义了 MCU 的 flash 和  ram 的地址、大小：

```
/* GD32VF103C8 */
MEMORY
{
	FLASH : ORIGIN = 0x08000000, LENGTH = 64k
	RAM : ORIGIN = 0x20000000, LENGTH = 20k
}

REGION_ALIAS("REGION_TEXT", FLASH);
REGION_ALIAS("REGION_RODATA", FLASH);
REGION_ALIAS("REGION_DATA", RAM);
REGION_ALIAS("REGION_BSS", RAM);
REGION_ALIAS("REGION_HEAP", RAM);
REGION_ALIAS("REGION_STACK", RAM);
```

接下来我们就可以在 Cargo.toml 文件里添加相关的依赖了，cargo build 会自动下载对应依赖的版本：

```
[dependencies]
longan-nano = "0.3.0"
gd32vf103xx-hal = "0.5.0"
embedded-hal = "0.2.6"
nb = "1.0.0"
riscv = "0.6.0"
riscv-rt = "0.10.0"
panic-halt = "0.2.0"
```

可以看到 Rust 层级非常明显，从底层的 riscv CPU 支持，到 riscv-rt 最小运行环境，接下来有通用的嵌入式抽象 embedded-hal，到 MCU 的 HAL 支持 gd32vf103xx-hal，最顶层是开发板 bsp 的支持 longan-nano。这里我使用了 riscv-rust 维护的 Longan Nano 的 bsp。 

最后当然就是 main.rs调用 GPIO 库：

```
#![no_std]
#![no_main]

use panic_halt as _;

use riscv_rt::entry;

use longan_nano::hal::{pac, prelude::*};
use longan_nano::hal::delay::McycleDelay;

use embedded_hal::digital::v2::OutputPin;

#[entry]
fn main() -> ! {
    let dp = pac::Peripherals::take().unwrap();
    let mut rcu = dp.RCU.configure().freeze();
    
    let gpioa = dp.GPIOA.split(&mut rcu);
    let mut pa7 = gpioa.pa7.into_push_pull_output();
    
    let mut delay = McycleDelay::new(&rcu.clocks);

    loop {
        pa7.set_low().unwrap();
        delay.delay_ms(500);
        pa7.set_high().unwrap();
        delay.delay_ms(500);
    }
}
```

我们可以从 longan_nano::hal 里找到各种外设所需要的库函数。

最终，编译生成 firmware.bin 

```
$ cargo build --release
$ cargo objcopy --target riscv32imac-unknown-none-elf --release -- -O binary firmware.bin
```

这里提醒一下，如果使用 GD-Link Programmer 上传程序到开发板，Connect 连接后，Program 完，记得点击 Run App 才会重新执行程序，不然即使复位，开发板也一直和调试器连接等待调试，不会自动执行程序。 

![img](https://doc.wuhanstudio.cc/posts/rust_proj/gdlin.png)

总的来看，如今 2023 年，这块开发板 Rust 嵌入式的层层支持已经非常完善了，项目创建运行过程非常顺利，没有碰到几年前 cargo objcopy 后生成的固件无法运行的错误。 