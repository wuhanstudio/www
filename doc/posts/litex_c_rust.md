LiteX 定制 SoC 上使用 C 和 Rust 嵌入式 (RISC-V)
======================================

在使用了各种开发板、MCU 后，开始尝试自己在 FPGA 上定制一个 SoC，并用 C 和 Rust 给这个 SoC 开发固件、移植操作系统 (RT-Thread, Zephyr)。

这篇文章会首先说明 CPU 和 SoC 的区别，接下来介绍在 FPGA 上使用 LiteX 定制一个包含 RISC-V CPU 的 SoC，以及给定制的 SoC 使用 C 和 Rust 开发固件，未来可能会继续移植操作系统 (RTOS)，项目所有的源码都放在了这个 Github 仓库里： 

- [GitHub - Using Rust on a customized LiteX SoC (RISC-V)](https://github.com/wuhanstudio/litex-soc-icesugar-rust)

## 0. Introduction

首先介绍 CPU 和 SoC 的区别：通常 CPU 大家比较熟悉，CPU 实现一些指令集 (ISA) 从而可以编程用作通用计算，常见的指令集有 x86, AMD64, ARM, MIPS, RISC-V。然而 CPU 不能独立运行，需要从外部存储加载代码、数据到内存 (RAM) 里执行。为了和外部世界交互，例如读写硬盘、传感器，连接显示屏，还会需要总线和一些外围设备 (Peripheral) ，这样各种总线、外围组件等一起组成了 SoC (System on Chip)。

例如下面这个可以运行 Linux 的 SoC 包含了 8 核 RISC-V CPU, ROM, SRAM, LiteDRAM, LiteSATA 等组件，所以通常来讲 CPU 是 SoC 的一部分。

当然，现在很多时候模糊了 CPU 和 SoC 的界限，例如 Intel CPU 内部集成了 GPU、硬件加密等各种外设模块，其实算是 SoC，可能解释起来比较麻烦，商业宣传上依旧称之为 Intel CPU。

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/litex.png)

我们可以用 FPGA 来设计一个软核 CPU，并添加总线、各种外设 (Peripheral) 组成一个 SoC。当然，如果所有的模块都从零开始写，会有太多重复的工作，于是出现了开源的 LiteX。

LiteX 可以用 Python 代码组装现有的 Verilog 模块 (也支持VHDL / (n)Migen / Spinal-HDL)，快速设计一个 SoC。

例如 LiteX 提供了现成的 CPU (VexRISCV, OpenRISC, LM32 等) ，常见的外设总线 (Wishbone, AXI, Avalon-ST)，还有各种外设模块 RAM, ROM, Timer, UART, JTAG, DRAM, 以太网，大大简化了 SoC 的设计。

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/litex_logo.png)

我手边有一个 ICESugar 开发板，就打算用它设计一个 SoC，再用 C 和  Rust 编写固件。

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/ice_sugar.png)

这个开发板用的 FPGA 是 iCE40UP5K，有 5K 个 Logic Cells (4-LUT + Carry + FF)，设计一个 MCU 级别的 SoC 足够了。从以前的经验来看，不同数量的 Logic Cell 可以实现的功能：

- 4-LUT < 2K：简单的数字电路；
- 4-LUT 2K - 4K：可以设计 CPU，MCU 级别的 SoC，运行裸机程序 (外部 SPI Flash)；
- 4-LUT 5K - 10K：可以设计 CPU，MCU 级别的 SoC，运行实时系统 (外部 SPI Flash)；
- 4-LUT 10K - 20K：可以设计能运行 Linux 的 SoC (外部 SDRAM)。

当然，这些都是最小系统的参考，毕竟也取决于设计的 SoC 片内 Flash, RAM 希望有多大，具体包含多少外设等等。

例如之前我用 [STEP-MXO2-V2](https://www.stepfpga.com/doc/xo2-4000hc) (LCMXO2-4000HC 4K LUTs) 运行了 Picosoc (RISCV32IMC)，并且从外部 SPI Flash 加载裸机程序：

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/step_fpga.png)

另一个项目用 Lichee Tang (EG4S20 20K LUTs) 可以运行 Picosoc 和 蜂鸟 E203，并移植了 RT-Thread Nano 实时系统：

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/lichee_tang.png)

到这里介绍了 CPU / SoC，FPGA，LiteX，下面分三步介绍：LiteX 定制 SoC，C 嵌入式开发，Rust 嵌入式开发。



## 1. LiteX 定制 SoC

### 1.1 安装 LiteX

我们首先安装 LiteX, 虽然 Github 上安装脚本就只有一个文件，但是安装过程会下载 LiteX 非常多的模块到单独的目录，所以建议单独新建一个文件夹执行 LiteX 安装脚本。

```
$ mkdir python-litex && cd python-litex
$ wget https://raw.githubusercontent.com/enjoy-digital/litex/master/litex_setup.py
$ chmod +x litex_setup.py
$ ./litex_setup.py --init --install --user `whoami` --config=full
```

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/python-litex.png)

LiteX 除了生成 Gateware (FPGA Bitstream)，还会编译一个默认的 BIOS 作为软件用来测试 SoC，所以我们还要安装 riscv-gcc 的工具链。

```
$ ./litex_setup.py --gcc=riscv
```

### 1.2 Litex 生成 SoC

这样 LiteX 就安装好了，它本身其实是一个 Python 软件包，可以调用 Python 模块的方式生成一个 SoC。

```
$ python3 -m litex_boards.targets.muselab_icesugar --build --doc
```

上面就是调用 Python 脚本生成了一个 SoC，它会在当前文件夹生成 build 目录，里面包含了 Gateware 和 Software。我手上的 ICESugar 开发板已经被 LiteX 支持了，所以可以直接调用内置的 python 模块。

```
$ python3 -m litex_boards.targets.muselab_icesugar --flash
```

如果开发板已经被 LiteX 支持，使用上面两行就可以生成一个 SoC (Gateware) 以及 BIOS (Software)，并且上传到开发板，在串口看到 SoC 的启动信息：

```
        __   _ __      _  __
       / /  (_) /____ | |/_/
      / /__/ / __/ -_)>  <
     /____/_/\__/\__/_/|_|
   Build your hardware, easily!

 (c) Copyright 2012-2022 Enjoy-Digital
 (c) Copyright 2007-2015 M-Labs

 BIOS built on Jan 13 2023 16:37:14
 BIOS CRC passed (079a83e1)

 LiteX git sha1: 0440733f

--=============== SoC ==================--
CPU:		VexRiscv_Lite @ 24MHz
BUS:		WISHBONE 32-bit @ 4GiB
CSR:		32-bit data
ROM:		32KiB
SRAM:		64KiB
FLASH:		8192KiB

--========== Initialization ============--

Initializing W25Q64FV SPI Flash @0x00800000...
SPI Flash clk configured to 12 MHz
Memspeed at 0x800000 (Sequential, 4.0KiB)...
   Read speed: 1.2MiB/s
Memspeed at 0x800000 (Random, 4.0KiB)...
   Read speed: 467.1KiB/s

--============== Boot ==================--
Booting from serial...
Press Q or ESC to abort boot completely.
sL5DdSMmkekro
             Timeout
No boot medium found

--============= Console ================--

litex> 
```

另外，我们还可以用 --doc选项为 SoC 生成一个文档，文档会列出所有的寄存器名称和地址。

![img](https://doc.wuhanstudio.cc/posts/litex_c_rust/litex_reg.png)

这样 LiteX 就为我们生成了 SoC Bitstream 和默认 BIOS 了，甚至还有 SoC 的寄存器文档。这个默认 BIOS 支持从 SPI Flash，串口，网络等其他位置加载后续的应用程序。

接下来我会以 ICESugar 为例介绍这个 SoC 的组成以及如何添加一个新的开发板到  LiteX。

### 1.3 LiteX 自定义开发板

如果自己的开发板不被 Litex 默认支持，也可以自己添加platform (FPGA 型号、板载资源) 和 target (期望生成的 SoC) ，下面链接是 LiteX 目前支持的 FPGA 开发板列表。

LiteX 目前支持的 FPGA 有 Xilinx (AMD), Altera (Intel), Lattice, Anlogic 各种平台，完整的 FPGA 厂商列表可以在这个目录下找到 https://github.com/enjoy-digital/litex/tree/master/litex/build。 

比如以 ICESugar 开发板 (Lattice) 为例，在 litex_boards/platforms/muselab_icesugar.py 里可以找到这个 platform 的定义，主要是定义自己的 FPGA 开发板芯片类型，以及有哪些外设接口，只要熟悉自己的 FPGA 开发板，添加一个新的 platform 并不太难。 

```
#
# This file is part of LiteX-Boards.
#
# Copyright (c) 2021 Hans Baier <hansfbaier@gmail.com>
# SPDX-License-Identifier: BSD-2-Clause

# iCESugar FPGA: https://www.aliexpress.com/item/4001201771358.html

from litex.build.generic_platform import *
from litex.build.lattice import LatticeiCE40Platform
from litex.build.lattice.programmer import IceSugarProgrammer

# IOs ----------------------------------------------------------------------------------------------

_io = [
    # Clk / Rst
    ("clk12", 0, Pins("35"), IOStandard("LVCMOS33")),

    # Leds R / G / B
    ("user_led_n",    0, Pins("40"), IOStandard("LVCMOS33")),
    ("user_led_n",    1, Pins("39"), IOStandard("LVCMOS33")),
    ("user_led_n",    2, Pins("41"), IOStandard("LVCMOS33")),

    # RGB led, active-low, alias for Leds
    ("rgb_led", 0,
        Subsignal("r", Pins("40")),
        Subsignal("g", Pins("39")),
        Subsignal("b", Pins("31")),
        IOStandard("LVCMOS33"),
    ),

    # Switches / jumper-attached to PMOD4
    ("user_sw", 0, Pins("18"), IOStandard("LVCMOS18")),
    ("user_sw", 1, Pins("19"), IOStandard("LVCMOS18")),
    ("user_sw", 2, Pins("20"), IOStandard("LVCMOS18")),
    ("user_sw", 3, Pins("21"), IOStandard("LVCMOS18")),

    # Serial
    ("serial", 0,
        Subsignal("rx", Pins("4")),
        Subsignal("tx", Pins("6"), Misc("PULLUP")),
        IOStandard("LVCMOS33")
    ),

    # SPIFlash
    ("spiflash", 0,
        Subsignal("cs_n", Pins("16"), IOStandard("LVCMOS33")),
        Subsignal("clk",  Pins("15"), IOStandard("LVCMOS33")),
        Subsignal("miso", Pins("17"), IOStandard("LVCMOS33")),
        Subsignal("mosi", Pins("14"), IOStandard("LVCMOS33")),
    ),

    # USB
    ("usb", 0,
        Subsignal("d_p", Pins("10")),
        Subsignal("d_n", Pins("9")),
        Subsignal("pullup", Pins("11")),
        IOStandard("LVCMOS33")
    ),
]

# Connectors ---------------------------------------------------------------------------------------

_connectors = [
    # Pin order similar to iCEBreaker to allow PMODs reuse.
    ("PMOD1", "10  6  3 48  9  4  2 47"),
    ("PMOD2", "46 44 42 37 45 43 38 36"),
    ("PMOD3", "34 31 27 25 32 28 26 23"),
    ("J7",    "48 - 3 47 - 2"), # Numbering similar to PMODS: 0: Marked pin.
]

# PMODS --------------------------------------------------------------------------------------------

def led_pmod_io_v11(pmod, offset=0):
    return [
        # LED PMOD: https://www.aliexpress.com/item/1005001504777342.html
        # Contrary to the supplied schematic, the two nibbles seem to be swapped on the board.
        ("user_led_n", offset + 0,  Pins(f"{pmod}:4"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 1,  Pins(f"{pmod}:5"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 2,  Pins(f"{pmod}:6"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 3,  Pins(f"{pmod}:7"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 4,  Pins(f"{pmod}:0"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 5,  Pins(f"{pmod}:1"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 6,  Pins(f"{pmod}:2"), IOStandard("LVCMOS33")),
        ("user_led_n", offset + 7,  Pins(f"{pmod}:3"), IOStandard("LVCMOS33")),
    ]

# Platform -----------------------------------------------------------------------------------------

class Platform(LatticeiCE40Platform):
    default_clk_name   = "clk12"
    default_clk_period = 1e9/12e6

    def __init__(self, toolchain="icestorm"):
        LatticeiCE40Platform.__init__(self, "ice40-up5k-sg48", _io, _connectors, toolchain=toolchain)

    def create_programmer(self):
        return IceSugarProgrammer()

    def do_finalize(self, fragment):
        LatticeiCE40Platform.do_finalize(self, fragment)
        self.add_period_constraint(self.lookup_request("clk12", loose=True), 1e9/12e6)
```

定义好了 **FPGA 开发板 (Platform)**，接下来需要定义 **SoC (Target)**，也就是我们想要生成的 SoC 的配置，例如使用什么 CPU，什么总线，有哪些外设，Flash、SRAM 的大小等等。这些也是在一个 Python 脚本定义的。

例如下面的 litex-boards/litex_boards/targets/muselab_icesugar.py定义了我们要生成的 SoC。我们定义了一个 RISC-V CPU （VexRISCV）以及它的时钟输入，系统主频：

```
# Set CPU variant
if kwargs.get("cpu_type", "vexriscv") == "vexriscv":
    kwargs["cpu_variant"] = "lite"

SoCCore.__init__(self, platform, sys_clk_freq, ident="LiteX SoC on Muselab iCESugar", **kwargs)
```

我们使用 FPGA 自带的 SPRAM 来生成 SoC 64KB 的 SRAM。

```
# 64KB SPRAM (used as SRAM) ---------------------------------------------------------------
self.spram = Up5kSPRAM(size=64*kB)
self.bus.add_slave("sram", self.spram.bus, SoCRegion(size=64*kB))
```

系统从 SPI Flash 启动，并且分配 32KB 作为 SoC 的 ROM。

```
# SPI Flash --------------------------------------------------------------------------------
from litespi.modules import W25Q64FV
from litespi.opcodes import SpiNorFlashOpCodes as Codes
self.add_spi_flash(mode="1x", module=W25Q64FV(Codes.READ_1_1_1), with_master=False)

# Add ROM linker region --------------------------------------------------------------------
self.bus.add_region("rom", SoCRegion(
    origin = self.bus.regions["spiflash"].origin + bios_flash_offset,
    size   = 32*kB,
    linker = True)
)
self.cpu.set_reset_address(self.bus.regions["rom"].origin)
```

当然还有最基本的外设，经典的跑马灯：

```
# Leds -------------------------------------------------------------------------------------
if with_led_chaser:
    led_pads = platform.request_all("user_led_n")
    self.leds = LedChaser(
        pads         = led_pads,
        sys_clk_freq = sys_clk_freq)
```

我们不需要单独定义串口，因为前面在 platform 里面定义了板载的串口之后，LiteX 会把它作为默认的串口。

```
# Serial
("serial", 0,
    Subsignal("rx", Pins("4")),
    Subsignal("tx", Pins("6"), Misc("PULLUP")),
    IOStandard("LVCMOS33")
),
```

从默认的选项里我们可以看到，系统主频默认是 24MHz，启动地址是 Flash 的偏移地址 0x40000，所以我们后面需要把固件烧录到这个地址。

```
parser = LiteXArgumentParser(platform=muselab_icesugar.Platform, description="LiteX SoC on iCEBreaker.")
parser.add_target_argument("--flash",             action="store_true",       help="Flash Bitstream.")
parser.add_target_argument("--sys-clk-freq",      default=24e6,  type=float, help="System clock frequency.")
parser.add_target_argument("--bios-flash-offset", default="0x40000",         help="BIOS offset in SPI Flash.")
args = parser.parse_args()
```

这是完整的 target SoC 定义文件，一共也就 100 来行 Python 代码就定义好一个 SoC：

```
#!/usr/bin/env python3

#
# This file is part of LiteX-Boards.
#
# Copyright (c) 2021 Hans Baier <hansfbaier@gmail.com>
# SPDX-License-Identifier: BSD-2-Clause

# iCESugar FPGA: https://www.aliexpress.com/item/4001201771358.html

from migen import *
from migen.genlib.resetsync import AsyncResetSynchronizer

from litex.gen import LiteXModule

from litex_boards.platforms import muselab_icesugar

from litex.soc.cores.ram import Up5kSPRAM
from litex.soc.cores.clock import iCE40PLL
from litex.soc.integration.soc_core import *
from litex.soc.integration.soc import SoCRegion
from litex.soc.integration.builder import *
from litex.soc.cores.led import LedChaser

kB = 1024
mB = 1024*kB

# CRG ----------------------------------------------------------------------------------------------

class _CRG(LiteXModule):
    def __init__(self, platform, sys_clk_freq):
        self.rst    = Signal()
        self.cd_sys = ClockDomain()
        self.cd_por = ClockDomain()

        # # #

        # Clk/Rst
        clk12 = platform.request("clk12")

        # Power On Reset
        por_count = Signal(16, reset=2**16-1)
        por_done  = Signal()
        self.comb += self.cd_por.clk.eq(ClockSignal())
        self.comb += por_done.eq(por_count == 0)
        self.sync.por += If(~por_done, por_count.eq(por_count - 1))

        # PLL
        self.pll = pll = iCE40PLL(primitive="SB_PLL40_PAD")
        self.comb += pll.reset.eq(self.rst)
        pll.register_clkin(clk12, 12e6)
        pll.create_clkout(self.cd_sys, sys_clk_freq, with_reset=False)
        self.specials += AsyncResetSynchronizer(self.cd_sys, ~por_done | ~pll.locked)
        platform.add_period_constraint(self.cd_sys.clk, 1e9/sys_clk_freq)

# BaseSoC ------------------------------------------------------------------------------------------

class BaseSoC(SoCCore):
    def __init__(self, bios_flash_offset, sys_clk_freq=24e6,
        with_led_chaser     = True,
        with_video_terminal = False,
        **kwargs):
        platform = muselab_icesugar.Platform()

        # CRG --------------------------------------------------------------------------------------
        self.crg = _CRG(platform, sys_clk_freq)

        # SoCCore ----------------------------------------------------------------------------------
        # Disable Integrated ROM/SRAM since too large for iCE40 and UP5K has specific SPRAM.
        kwargs["integrated_sram_size"] = 0
        kwargs["integrated_rom_size"]  = 0

        # Set CPU variant
        if kwargs.get("cpu_type", "vexriscv") == "vexriscv":
            kwargs["cpu_variant"] = "lite"
        SoCCore.__init__(self, platform, sys_clk_freq, ident="LiteX SoC on Muselab iCESugar", **kwargs)

        # 64KB SPRAM (used as SRAM) ---------------------------------------------------------------
        self.spram = Up5kSPRAM(size=64*kB)
        self.bus.add_slave("sram", self.spram.bus, SoCRegion(size=64*kB))

        # SPI Flash --------------------------------------------------------------------------------
        from litespi.modules import W25Q64FV
        from litespi.opcodes import SpiNorFlashOpCodes as Codes
        self.add_spi_flash(mode="1x", module=W25Q64FV(Codes.READ_1_1_1), with_master=False)

        # Add ROM linker region --------------------------------------------------------------------
        self.bus.add_region("rom", SoCRegion(
            origin = self.bus.regions["spiflash"].origin + bios_flash_offset,
            size   = 32*kB,
            linker = True)
        )
        self.cpu.set_reset_address(self.bus.regions["rom"].origin)

        # Leds -------------------------------------------------------------------------------------
        if with_led_chaser:
            led_pads = platform.request_all("user_led_n")
            self.leds = LedChaser(
                pads         = led_pads,
                sys_clk_freq = sys_clk_freq)

# Flash --------------------------------------------------------------------------------------------

def flash(bios_flash_offset):
    from litex.build.lattice.programmer import IceSugarProgrammer
    prog = IceSugarProgrammer()
    prog.flash(bios_flash_offset, "build/muselab_icesugar/software/bios/bios.bin")
    prog.flash(0x00000000,        "build/muselab_icesugar/gateware/muselab_icesugar.bin")

# Build --------------------------------------------------------------------------------------------

def main():
    from litex.build.parser import LiteXArgumentParser
    parser = LiteXArgumentParser(platform=muselab_icesugar.Platform, description="LiteX SoC on iCESugar.")
    parser.add_target_argument("--flash",             action="store_true",       help="Flash Bitstream.")
    parser.add_target_argument("--sys-clk-freq",      default=24e6,  type=float, help="System clock frequency.")
    parser.add_target_argument("--bios-flash-offset", default="0x40000",         help="BIOS offset in SPI Flash.")
    args = parser.parse_args()

    soc = BaseSoC(
        bios_flash_offset = int(args.bios_flash_offset, 0),
        sys_clk_freq      = args.sys_clk_freq,
        **parser.soc_argdict
    )
    builder = Builder(soc, **parser.builder_argdict)
    if args.build:
        builder.build(**parser.toolchain_argdict)

    if args.load:
        prog = soc.platform.create_programmer()
        prog.load_bitstream(builder.get_bitstream_filename(mode="sram", ext=".bin")) # FIXME

    if args.flash:
        flash(int(args.bios_flash_offset, 0))

if __name__ == "__main__":
    main()
```

带 RISC-V CPU 的 SoC 已经生成了，接下来我们就可以把它当作一个 MCU 进行固件开发了，下面我会分别介绍如何在这个定制的 SoC 上使用 C 和 Rust。



## 2. C 嵌入式开发

前面提到 LiteX 默认会生成一个 BIOS 用于启动后续的应用程序，但是我并不想使用这个 BIOS，而是希望直接从前面定义的 Flash 的 0x40000 地址启动自己的固件。

除了 BIOS，LiteX 也很贴心的提供了一个固件 Demo，我们可以用下面的命令生成 C 固件 Demo 程序，记得把 --build-path替换为上一步 SoC 的编译目录。

```
$ litex_bare_metal_demo --build-path=/home/YOUR_NAME/litex-soc-icesugar-rust/build/muselab_icesugar/
```

不过这个默认的 Demo 程序需要通过 BIOS 加载到内存运行，而我们前面定义的 SoC 并没有分配main_ram，所以我修改了linker.ld，让这个 Demo 从 SPI Flash 加载运行，主要是把 .text .rodata .data 字段放到了 rom 而不是默认的 main_ram。 

```
.text :
{
	_ftext = .;
	/* Make sure crt0 files come first, and they, and the isr */
	/* don't get disposed of by greedy optimisation */
	*crt0*(.text)
	KEEP(*crt0*(.text))
	KEEP(*(.text.isr))

	*(.text .stub .text.* .gnu.linkonce.t.*)
	_etext = .;
} > rom

.rodata :
{
	. = ALIGN(8);
	_frodata = .;
	*(.rodata .rodata.* .gnu.linkonce.r.*)
	*(.rodata1)
	*(.got .got.*)
	*(.toc .toc.*)
	. = ALIGN(8);
	_erodata = .;
} > rom

.data :
{
	. = ALIGN(8);
	_fdata = .;
	*(.data .data.* .gnu.linkonce.d.*)
	*(.data1)
	_gp = ALIGN(16);
	*(.sdata .sdata.* .gnu.linkonce.s.*)
	. = ALIGN(8);
	_edata = .;
} > sram AT > rom
```

这样就可以编译 Demo 程序并上传到 SPI Flash 运行了，覆盖掉 LiteX 默认的 BIOS。

```
$ cd demo
$ make
$ icesprog -w demo.bin -o 0x40000
```

FPGA 上电后自动执行 Demo 程序串口会打印输出：

```
LiteX minimal demo app built Jan 13 2023 16:40:00

Available commands:
help               - Show this command
reboot             - Reboot CPU
led                - Led demo
donut              - Spinning Donut demo
helloc             - Hello C

litex-demo-app> 
```

默认的 Demo 包含了 C  程序的 Hello World, Donut 和控制 LED。

顺便一提，**前面生成 SoC 的时候会自动生成底层寄存器相关的 C 头文件和驱动**，所以我们 C 程序并不需要从寄存器定义写起。

```
#include <stdio.h>

void helloc(void);
void helloc(void) {
  printf("C: Hello, world!\n");
}
```

例如上面的 C Hello 程序，stdio的printf可以直接调用，并不需要重写串口驱动，这也是使用  LiteX 的好处之一。



## 3. Rust 嵌入式开发

### 3.1 安装 Rust 工具链

我们需要先安装 Rust 对 RISC-V 的支持，这里不需要单独安装 riscv-gcc 工具链，直接使用 Cargo 就可以了。

```
$ rustup target add riscv32imac-unknown-none-elf
$ cargo install cargo-binutils
$ rustup component add llvm-tools-preview
```

如果想直接体验 Rust 固件的话，可以用 cargo objcopy 生成 bin 固件。 

```
$ cd app
$ cargo objcopy --target riscv32i-unknown-none-elf --release -- -O binary app.bin
$ icesprog -o 0x40000 app.bin
```

这个固件只是在串口每隔 500ms 打印一个 Hello LiteX SoC：

```
Hello LiteX SoC
Hello LiteX SoC
...
```

下面我会介绍怎么生成这个 Rust 项目的。

### 3.2 SVD 生成 Rust Crate

为了使用 Rust 开发固件，我们需要生成开发板的 Rust Peripheral Access Crate (PAC)，例如在 Github 仓库里我把它命名成了 icesugar-pac，这个 crate 提供了底层寄存器相关的定义和控制，例如 TIMER0，UART0，LED 等。

这个 Rust PAC 并不需要我们自己从头写，可以从 SVD 文件 (System View Description) 自动生成，前面我们用 LiteX 生成 SoC 的时候，就可以传入 --csr-svd 选项生成 SoC 的 SVD 文件。 

```
$ python3 -m litex_boards.targets.muselab_icesugar --csr-json csr.json --timer-uptime --build --csr-svd icesugar.svd
```

例如我们生成的 icesugar.svd 文件里包含了外设寄存器相关的定义，寄存器大小、地址、默认值等： 

```
<peripheral>
    <name>LEDS</name>
    <baseAddress>0xF0001000</baseAddress>
    <groupName>LEDS</groupName>
    <registers>
        <register>
            <name>OUT</name>
            <description><![CDATA[Led Output(s) Control.]]></description>
            <addressOffset>0x0000</addressOffset>
            <resetValue>0x00</resetValue>
            <size>32</size>
            <fields>
                <field>
                    <name>out</name>
                    <msb>2</msb>
                    <bitRange>[2:0]</bitRange>
                    <lsb>0</lsb>
                </field>
            </fields>
        </register>
    </registers>
    <addressBlock>
        <offset>0</offset>
        <size>0x4</size>
        <usage>registers</usage>
    </addressBlock>
</peripheral>
```

有了这个 SVD 文件，我们可以用 [svd2rust](https://github.com/rust-embedded/svd2rust) 生成对应的 Rust 库。

```
$ cargo install svd2rust

$ cargo new --lib icesugar-pac && cd icesugar-pac
$ cp ../icesugar.svd ./

$ svd2rust -i icesugar.svd
$ mv generic.rs src/
```

这样就会生成这样一个文件结构：

```
.
├── build.rs
├── Cargo.toml
├── device.x
├── icesugar.svd
└── src
    ├── generic.rs
    └── lib.rs
```

我们需要手动在 Cargo.toml 文件里添加依赖：

```
[dependencies]
bare-metal = "1.0"
riscv = "0.10"
vcell = "0.1"
riscv-rt = { optional = true, version = "0.10" }

[build-dependencies]
svd2rust = { version = "0.28", default-features = false }

[features]
default = ["rt"]
rt = ["dep:riscv-rt"]
```

有了 Rust PAC 支持，最后我们就可以开始 Rust 嵌入式开发了，创建 Rust 嵌入式项目可以参考这篇文章：

总体流程就是先创建 Rust 项目模板，在 .cargo/config 里定义生成的目标硬件 RISC-V 以及链接脚本。

```
$ cargo new app
```

 在 .cargo/config里指定 riscv32i-unknown-none-elf和链接脚本 memory.x： 

```
# .cargo/config
[target.riscv32i-unknown-none-elf]
rustflags = [
  "-C", "link-arg=-Tmemory.x",
  "-C", "link-arg=-Tlink.x",
  "-C", "linker-plugin-lto",
  # The following option can decrease the code size significantly.  We don't
  # have it enabled by default as it gets rid of panic information we do want
  # to have those when developing code.
  # "-C", "force-frame-pointers=no",
]

[build]
target = "riscv32i-unknown-none-elf"
```

这里 memory.x文件里定义的 layout 需要和之前 SoC 的定义的布局匹配，比如我们从偏移地址 0x40000 启动固件：

```
MEMORY {
	sram : ORIGIN = 0x00000000, LENGTH = 0x00010000
	spiflash : ORIGIN = 0x00800000, LENGTH = 0x00800000
	rom : ORIGIN = 0x00840000, LENGTH = 0x00008000
}

REGION_ALIAS("REGION_TEXT", rom);
REGION_ALIAS("REGION_RODATA", rom);
REGION_ALIAS("REGION_DATA", sram);
REGION_ALIAS("REGION_BSS", sram);
REGION_ALIAS("REGION_HEAP", sram);
REGION_ALIAS("REGION_STACK", sram);
```

 当然，还需要在 cargo.toml 里添加上一步 SVD 生成的 icesugar-pac等依赖：

```
[package]
name = "app"
version = "0.1.0"
edition = "2023"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[dependencies]
icesugar-pac = { path = "../icesugar-pac"}
panic-halt = "0.2.0"
riscv-rt = { version = "0.10.0"}

[profile.release]
# Keep debug information for release builds, for easier debugging.
# It will be removed during the conversion to the .dfu file.
# debug = true

# Improve code generation
lto = true
# codegen-units = 1
```

 最终我们就可以开始写 Rust 主程序了，初始化定时器并每隔 500 毫秒打印字符到串口：

```
#![no_std]
#![no_main]

extern crate panic_halt;

use icesugar_pac;
use riscv_rt::entry;

mod timer;
mod print;

use timer::Timer;

const SYSTEM_CLOCK_FREQUENCY: u32 = 24_000_000;

// This is the entry point for the application.
// It is not allowed to return.
#[entry]
fn main() -> ! {
    let peripherals = unsafe { icesugar_pac::Peripherals::steal() };
    // let peripherals = icesugar_pac::Peripherals::take().unwrap();

    print::print_hardware::set_hardware(peripherals.UART);
    let mut timer = Timer::new(peripherals.TIMER0);

    loop {
        print!("Hello LiteX SoC\r\n");
        msleep(&mut timer, 500);
    }
}

fn msleep(timer: &mut Timer, ms: u32) {
    timer.disable();

    timer.reload(0);
    timer.load(SYSTEM_CLOCK_FREQUENCY / 1_000 * ms);

    timer.enable();

    // Wait until the time has elapsed
    while timer.value() > 0 {}
}
```

完整的 Rust 主程序在 app/src/main.rs 可以找到，前面提到我们可以用 cargo objcopy编译生成最终的固件 app.bin： 

```
$ cargo objcopy --target riscv32i-unknown-none-elf --release -- -O binary app.bin
$ icesprog -o 0x40000 app.bin
```

终于到这里，我们就成功在 LiteX 定制的 SoC 上运行 Rust 嵌入式程序了。

### 3.3 小结

最后，再次顺便一提，项目所有的代码都放在了这个 Github 仓库里：

2023 年自己尝试的时候，网上还没有找到一篇文档完整的描述 LiteX 定制 SoC 并编写 C 和 Rust 固件，尝试过程中也碰到了不少问题，最后把零散的资料整理在一起成了一个完整的项目，后面有时间再尝试给这个 SoC 移植 RT-Thread 和 Zephyr 实时系统。



## 4. References

- https://github.com/icebreaker-fpga/icebreaker-litex-examples
- https://docs.rs/svd2rust/latest/svd2rust/
- http://pepijndevos.nl/2020/08/04/a-rust-hal-for-your-litex-fpga-soc.html
- https://github.com/pepijndevos/rust-litex-example
- https://github.com/pepijndevos/rust-litex-hal