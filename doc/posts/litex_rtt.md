LiteX 定制 SoC 上移植实时系统 (RT-Thread)
====================================

```
        __   _ __      _  __
       / /  (_) /____ | |/_/
      / /__/ / __/ -_)>  <
     /____/_/\__/\__/_/|_|
   Build your hardware, easily!

 (c) Copyright 2012-2023 Enjoy-Digital
 (c) Copyright 2007-2015 M-Labs

 BIOS built on Sep  3 2023 19:17:53
 BIOS CRC passed (4681dd6a)
--=============== SoC ==================--
CPU:		PicoRV32 @ 24MHz
BUS:		WISHBONE 32-bit @ 4GiB
CSR:		32-bit data
ROM:		32.0KiB
SRAM:		64.0KiB
FLASH:		8.0MiB
--============= Console ================--
litex>

 \ | /
- RT -     Thread Operating System
 / | \     3.1.3 build Sep  3 2023
 2006 - 2019 Copyright by rt-thread team
Hello picorv32 World
```



## Introduction

在用了各种 MCU 之后，一直都想用 FPGA 自己造一个 SoC，再给它移植操作系统。

两年前，我在 Lichee Tang (EG4S20) 国产 FPGA 上移植了 Picorv32 和 蜂鸟 HBird E203，这两个都是 RISC-V 的软核，并且移植了 RT-Thread Nano 实时系统，但是却一直不是很满意。

- [GitHub - Picorv32 on Lichee Tang](https://github.com/wuhanstudio/picorv32_EG4S20)
- [HBird E203 on Lichee Tang](https://github.com/wuhanstudio/hbird_e203_tang)

因为这两个 SoC 都不是很灵活，虽然实现了基本的功能 (RISC-V + UART + GPIO + Timer)，但是如果想继续扩展其他模块 (Eth, SDCard, DRAM)，直到希望能运行 Linux，就不是很方便了。

半年前，我接触到了 LiteX，可以用 Python 在不同型号的 FPGA 上配置一个灵活的 SoC，搭配各种 CPU (VexRISCV, PicoRV32, NEORV32, LM32) 和 外设，甚至支持 Zephyr 和 Linux。

于是我就用 LiteX 在 ICESugar 开发板上，定制了一个 VexRiscv (RV32I) 的 SoC，还顺便用 Rust 跑了个定时器点灯的小程序。

但是，我却没有进一步移植 RT-Thread，趁着最近休假前，感觉可以再更进一步。

- [LiteX 定制 SoC 上使用 C 和 Rust 嵌入式 (RISC-V)](https://doc.wuhanstudio.cc/posts/litex_c_rust.html)



## 1. RISC-V 不同指令集扩展

我打算继续使用 RISC-V，不过在移植 RTOS 前得选定 RISC-V 的扩展指令集 (IMAC)。

于是我查了一下 Zephyr RTOS 支持的 RISC-V CPU，有 VexRiscv (**RV32IM**) [1] 和 NEOV32 (**RV32IMC**) [2]。因此，为了移植 RT-Thread Nano，**至少得用个 RV32IM 的 RISC-V CPU**。

这里顺便一提，之前使用 Rust 的时候，虽然我用 rustc 看到了很多 riscv32 的支持列表，但是这只是编译器支持列表，要想运行程序还需要 riscv-rt 等最小环境。最后，我只亲自测试并确认了 Rust 支持 RV32I (VexRiscv) 和 RV32IMAC (GD32VF103)，并顺利运行了固件。

```
$ rustc --print target-list | grep riscv32
riscv32gc-unknown-linux-gnu
riscv32gc-unknown-linux-musl
riscv32i-unknown-none-elf
riscv32im-unknown-none-elf
riscv32imac-esp-espidf
riscv32imac-unknown-none-elf
riscv32imac-unknown-xous-elf
riscv32imc-esp-espidf
riscv32imc-unknown-none-elf
```

**这次我打算使用 Picorv32 (RV32IM)**，虽然我尝试过了，但是很遗憾，还没能在 RV32IM 的 CPU 上跑起来 Rust。



## 2 LiteX CPU 型号

在选定了 Picorv32 (RV32IM) 之后，还需要找到 LiteX 的对应配置。**因为 LiteX 非常灵活，针对同一款 CPU，我们也可以配置支持不同的指令集扩展。**

比如在 picorv32 的 [core.py](http://core.py/) 里面，我们可以看到 LiteX 支持 minimal (RV32I) 和 standard (RV32IM) 两种配置。

https://github.com/enjoy-digital/litex/blob/master/litex/soc/cores/cpu/picorv32/core.py

```
CPU_VARIANTS = ["minimal", "standard"]

# GCC Flags ----------------------------------------------------------------------------------------

GCC_FLAGS = {
    #                               /------------ Base ISA
    #                               |    /------- Hardware Multiply + Divide
    #                               |    |/----- Atomics
    #                               |    ||/---- Compressed ISA
    #                               |    |||/--- Single-Precision Floating-Point
    #                               |    ||||/-- Double-Precision Floating-Point
    #                               i    macfd
    "minimal":          "-march=rv32i2p0       -mabi=ilp32 ",
    "standard":         "-march=rv32i2p0_m     -mabi=ilp32 ",
}
```

而 VexRiscv 则支持更多的配置，从 RV32I，RV32IM，RV32IMA，到 RV32IMAC 应有尽有。不过很遗憾，我用的 ICESugar FPGA 开发板资源有限，塞不下 VexRiscv 的 RV32IM 配置，**所以我最后选择了 picorv32 standard** 。

```
GCC_FLAGS = {
    #                                  /---------- Base ISA
    #                                  |    /----- Hardware Multiply + Divide
    #                                  |    |/---- Atomics
    #                                  |    ||/--- Compressed ISA
    #                                  |    |||/-- Single-Precision Floating-Point
    #                                  |    ||||/- Double-Precision Floating-Point
    #                                  i    macfd
    "minimal":              "-march=rv32i2p0       -mabi=ilp32",
    "minimal+debug":        "-march=rv32i2p0       -mabi=ilp32",
    "minimal+debug+hwbp":   "-march=rv32i2p0       -mabi=ilp32",
    "lite":                 "-march=rv32i2p0_m     -mabi=ilp32",
    "lite+debug":           "-march=rv32i2p0_m     -mabi=ilp32",
    "lite+debug+hwbp":      "-march=rv32i2p0_m     -mabi=ilp32",
    "standard":             "-march=rv32i2p0_m     -mabi=ilp32",
    "standard+debug":       "-march=rv32i2p0_m     -mabi=ilp32",
    "imac":                 "-march=rv32i2p0_mac   -mabi=ilp32",
    "imac+debug":           "-march=rv32i2p0_mac   -mabi=ilp32",
    "full":                 "-march=rv32i2p0_m     -mabi=ilp32",
    "full+cfu":             "-march=rv32i2p0_m     -mabi=ilp32",
    "full+debug":           "-march=rv32i2p0_m     -mabi=ilp32",
    "full+cfu+debug":       "-march=rv32i2p0_m     -mabi=ilp32",
    "linux":                "-march=rv32i2p0_ma    -mabi=ilp32",
    "linux+debug":          "-march=rv32i2p0_ma    -mabi=ilp32",
    "linux+no-dsp":         "-march=rv32i2p0_ma    -mabi=ilp32",
    "secure":               "-march=rv32i2p0_ma    -mabi=ilp32",
    "secure+debug":         "-march=rv32i2p0_ma    -mabi=ilp32",
}
```



## 3 RT-Thread 移植

关于 LiteX 的介绍，可以参照我之前的一篇文章，这里就不重复介绍了。

之前提过，LiteX 生成 SoC 后，还会生成对应的 芯片文档 和 CSR 寄存器头函数，以及最基本的 C Runtime。所以我们可以对照生成的 CSR 寄存器布局，来完成移植工作。

![img](https://doc.wuhanstudio.cc/posts/litex_rtt/litex-reg.png)

比如下面的串口输出，CSR_UART_BASE 是 LiteX 自动生成的，它的定义可以在 csr.h 头文件里面找到。

```
#include <generated/csr.h>

#define reg_uart_data (*(volatile rt_uint32_t*)CSR_UART_BASE)

void rt_hw_console_output(const char *str)
{
    int i=0;
    for(i=0;'\0' != str[i];i++)
    {
        if(str[i] == '\n')
        {
            reg_uart_data = '\r';
        }
        reg_uart_data = str[i];
    }
}

char rt_hw_console_getchar(void)
{
    return (char)((*(volatile int*)CSR_UART_BASE)&0xFF);
}
```

当然，根据芯片的 Memory Layout，我们也需要修改链接脚本。我定制的 SoC 使用了 64KM 的 SRAM 和 32KB 的 Flash。

```
MEMORY {
	sram : ORIGIN = 0x00000000, LENGTH = 0x00010000
	rom : ORIGIN = 0x00840000, LENGTH = 0x00008000
	csr : ORIGIN = 0x82000000, LENGTH = 0x00010000
}
```

**然而，实不相瞒，在 RT-Thread 上的移植，还没有完全完成。**

现在的状况是 CPU 能正常初始化，开机打印 RTT 的 Logo，并且可以进入 main 函数打印 Hello World，但是卡死在 了 MSH 控制台。

因为我只移植了串口和 Context Switch，可能是定时器和中断可能还有些问题，只能等以后有时间再更新了。

这里留白给未来的我更新 。。。。。。

```
项目源码：
https://github.com/wuhanstudio/litex-soc-icesugar-rust

当前进度：
VexRiscv (RV32I)，支持 Rust，不支持 RT-Thread

项目源码：
https://github.com/wuhanstudio/litex-picorv32-rtthread

当前进度：
Picorv32 (RV32IM)，不支持 Rust，支持 RT-Thread
```

## 总结

总体对 LiteX 的体验还是非常不错的。

- 在不同型号的 FPGA 上，几乎可以无缝从 VexRiscv 切换到 Picorv32 或者 NEORV32。因为生成新的 SoC 后虽然寄存器的布局会发生变化，但是对应的改动都会保存到自动生成的 csr.h 头文件里，并且 LiteX 也会自动生成一套 libc / libbase，包括了串口驱动。所以只要 CPU 的指令集是兼容的，顶层的 C 程序几乎不需要做改动。
- 另一方面，也可以用 SVD 文件自动生成 Rust 需要的 PAC 库，虽然我只测试通过 了 RV32I 和 RV32IMAC，没有成功 RV32IM，因为 Rust 对 RISC-V 支持的生态还不是特别完善。

现在定制的 SoC，运行了基本的 C 程序，跑起来了 Rust，距离 RT-Thread 的支持也只差最后一步了。未来还可以考虑挂上硬件加速器，例如 TRIVIUM 和 PRESENT，矩阵运算加速等。

虽然这些 Side Project 跟自己的科研 (CARLA Autonomous Driving & Adversarial Attack) 关系不大，但是现在自己对深度学习模型的训练、部署，以及到操作系统的移植，和 CPU 指令集的硬件加速，都有了比较清晰的认知。**在科研发文章之余，偶尔兴趣使然地给开发板清清灰，感觉自己对科研的热情和好奇心又满上了。**



## **References**

[1] [GitHub - litex-hub/zephyr-on-litex-vexriscv](https://github.com/litex-hub/zephyr-on-litex-vexriscv)

[2] [NEORV32 - Zephyr Project Documentation](https://docs.zephyrproject.org/latest/boards/riscv/neorv32/doc/index.html)