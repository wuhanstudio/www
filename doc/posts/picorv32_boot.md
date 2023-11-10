Picorv32 启动流程 + 中断 (RV32IM)
============================

> Picorv32 是一个只用 3000 行 Verilog 代码实现的 RISC-V CPU。

之前的文章介绍了 RISC-V  指令集设计 (CPU)，LiteX 定制 SoC，这篇文章会介绍 CPU 启动流程 (裸机程序)，最后一步则是移植操作系统 RT-Thread Nano。

这样分成4步，我们就在 FPGA 上定制了一个 SoC (RISC-V 软核)，并移植了实时系统 (RTOS)。

- [1] CPU 设计：[Picorv32 自定义 RISC-V 中断指令](https://zhuanlan.zhihu.com/p/658051034)
- [2] SoC 设计：[LiteX 定制 SoC (RISC-V CPU)](https://zhuanlan.zhihu.com/p/598689675)
- **[3] SoC 启动：Picorv32 启动流程 (裸机程序)**
- [4] 操作系统：[Picorv32 移植 RT-Thread Nano](https://zhuanlan.zhihu.com/p/654103964) (In Progress)

所以这篇文章在前两篇的基础上，假定大家已经熟悉了 RISC-V 指令集，并且在 IceSugar 开发板 (或者其他支持 LiteX 的 FPGA) 上运行了 Picorv32 SoC，接下来要做的是给这个 FPGA 上的 SoC 编写固件程序。

> 顺便一提，第二篇文章还介绍了如何在 LiteX 定制的 SoC 上使用 C 和 Rust，不过当时 CPU 用的 VexRiscv，这篇文章着重于 Picorv32 的 CPU 启动流程。不过它们都是 RISC-V CPU，只是 Picorv32 为了硬件设计简单，没有遵循 RISC-V 的中断标准，而是自定义了 R-type 的中断指令。



## 0 最终效果

先放上这篇文章的最终效果，就是在 LiteX 定制的 SoC 上运行一个裸机程序 (没有操作系统)，利用定时器每隔1秒打印 Hello World，并且响应来自串口的中断（当然计数也用到了定时器中断），下一篇则是移植 RT-Thread Nano 实时系统 （项目源码在 GitHub 上）。

- [GitHub: litex-picorv32-rtthread](https://github.com/wuhanstudio/litex-picorv32-rtthread)

![img](https://doc.wuhanstudio.cc/posts/picorv32_boot/litex_demo.png)



## 1 链接脚本 linker.ld

**我们首先要知道 CPU 上电后从哪里加载程序。**我用的 IceSugar 开发板有一个 SPI Flash，所有的程序都保存在这个 SPI Flash 里。

![img](https://doc.wuhanstudio.cc/posts/picorv32_boot/ice_sugar.png)

最初开发板上电后，FPGA 首先从 SPI Flash 起始地址 (0x00000000) 读取 FPGA 的固件，这样 FPGA 就被设置成了软核 RISC-V CPU；接下来软核 CPU 开始读取 BIOS 程序，也就是打印第一张图里面大大的 LiteX Logo 和 SoC 的信息。

因此，我们可以在 LiteX SoC 的配置程序 (muselab_icesugar.py) 里面看见，我们首先把 FPGA 的固件烧录到了 0x00000 的位置，接下来把 BIOS 烧录到了 0x40000 的位置。

```
# FPGA 固件偏移地址 0x00000
prog.flash(0x00000000,        "build/muselab_icesugar/gateware/muselab_icesugar.bin")

# BIOS 偏移地址 0x40000，可以自定义
parser.add_target_argument("--bios-flash-offset", default="0x40000",         help="BIOS offset in SPI Flash.")
prog.flash(bios_flash_offset, "build/muselab_icesugar/software/bios/bios.bin")
```

**这里的 BIOS 是 LiteX 提供的一个默认裸机程序**，为了让我们测试 FPGA 顺利被设置成了 LiteX SoC。当然， 我们也可以覆盖这个默认的 BIOS，换成我们自己的程序（这也是后面我们要做的），所以每次烧录程序我们都覆盖了 SPI Flash 地址 0x40000 的程序。

```
# 烧录到 0x40000 覆盖 BIOD
icesprog -w demo.bin -o 0x40000
```

> 顺便一提，视力异常好的朋友可能注意到开发板上，在 FPGA 芯片左边，居然有个 STM32，这个 STM32 是 ICELink 帮助烧录程序到 SPI Flash，所以我们才可以在电脑上调用 iceprog 下载程序。

**于是我们清楚了，Picorv32 开机后会从 SPI Flash 的 0x40000 位置执行程序**。在 LiteX SoC 的设计里，我们也告诉了 SoC 在偏移地址 0x40000 的位置，有一个 32KB 的 ROM，开机后请从这里执行程序。

```
# Add ROM linker region --------------------------------------------------------------------
# BIOS 偏移地址 0x40000，可以自定义
self.bus.add_region("rom", SoCRegion(
    origin = self.bus.regions["spiflash"].origin + bios_flash_offset,
     size   = 32*kB,
     linker = True)
)
self.cpu.set_reset_address(self.bus.regions["rom"].origin)
```

**不过前面提到的都是物理地址，**我们在写固件程序的时候，还需要给 GCC 编译器提供链接脚本 linker.ld，告诉编译器应该把代码 (code) 和 数据 (data)，分别放在哪里。于是我们需要在 linker.ld 文件里指定 ROM (固件) 和 SRAM (内存) 的位置。

```
MEMORY {
	sram : ORIGIN = 0x00000000, LENGTH = 0x00010000
	spiflash : ORIGIN = 0x00800000, LENGTH = 0x00800000
	rom : ORIGIN = 0x00840000, LENGTH = 0x00008000
	csr : ORIGIN = 0x82000000, LENGTH = 0x00010000
}
```

**奇怪的是，上面 ROM 的地址是 0x840000，我们前面不是说固件放在了 SPI Flash 地址 0x40000 的位置吗？**这是因为 CPU 是通过总线 (BUS) 和外部设备，例如 SPI Flash 通信的。在 CPU 的内部总线上，SPI Flash 被分配到的地址是 0x800000，所以 CPU 总线位置 0x800000 + SPI Flash 物理偏移地址 0x40000 就得到了 CPU 视角下固件代码的位置 0x840000。

> LiteX 的好处在于，前面我提到的链接脚本 linker.ld 是自动生成的，我们并不需要手动去计算，在生成 SoC 的时候，这些地址 LiteX 都会帮我们计算好，所以这里我只是解释一下 LiteX 是怎么计算程序加载地址的。



## 2 汇编启动 start.S

现在我们知道了，只要把固件烧录到 SPI Flash 地址 0x40000 的位置，CPU 开机就会从那里加载程序。我们还要告诉编译器，把我们的入口函数放在那个位置，这样开机就会加载入口函数 _start。

```
# 程序入口位置
ENTRY(_start)

SECTIONS
{
	.text :
	{
		_ftext = .;
		/* Make sure start.S files come first, and then the isr */
		/* don't get disposed of by greedy optimisation */
		*start*(.text)
		KEEP(*start*(.text))
		KEEP(*(.text.irq))

		*(.text .stub .text.* .gnu.linkonce.t.*)
		_etext = .;
	} > rom
}
```

这样我们就可以开始写固件程序了，我们首先需要用汇编初始化 CPU 状态，才能跳转到 C 程序。在 start.S 汇编代码里定义了 _start 入口函数，接下来一行跳转指令到 _crt0 函数，在那里完成 CPU 的初始化。

```
// 包含 picorv32 自定义的 R-type 指令
#include "custom_ops.S"

.global _start
_start:

.org 0x00000000 # Reset
  j _crt0

.org 0x00000010 # IRQ
_irq_vector:
 中断处理函数

_crt0:
 CPU 初始化
```

有人可能会问，为什么要跳转到 _crt0 呢？直接在这里初始化 CPU 不就可以了吗？这是因为 picorv32 规定了在代码的 0x10 位置 (16 字节)，放置中断处理函数，每次 CPU 发生中断 (定时器，串口) 就会自动执行 0x10 位置的代码。

```
0 字节：
  上电后，自动执行这里的代码
  这里代码太长，就会覆盖下面的中断处理

16字节：
  中断处理
  放在这里的代码，每次 CPU 中断会自动执行；

主程序：
   CPU 初始化，写多长都可以，不用担心覆盖中断函数
```

如果我们开始的时候不跳转，那就最多只能写 16 字节的代码，再写就覆盖中断函数了，所以我们把实际的初始化代码跳转到中断函数后面，就不用担心覆盖中断函数了。

> 顺便一提，_crt0 代表 C Runtime，意思是这段代码执行完就跳转到 C 环境

那么 CPU 初始化要做些什么呢？我们首先把寄存器用 0 初始化，RISC-V 一共有 32 个通用寄存器，所以我们首先把它们都复位成 0；接下来我们要先禁用全部中断，因为 CPU 还没初始化，我们不希望代码跳转到其他位置；然后就是设置栈空间，这样 CPU 就知道数据要保存在哪里；最后一步就是跳转到 main 函数了，从此我们就可以用 C 写 main() 了。

```
_crt0:
  /* 初始化 32 个通用寄存器 */
  addi x1, zero, 0
  addi x2, zero, 0
  ... 省略 ...
  addi x30, zero, 0
  addi x31, zero, 0

  /* 暂时关闭全部中断 */
  li t0, 0xffffffff
  picorv32_maskirq_insn(zero, t0)
  /* reflect that in _irq_mask */
  la t1, _irq_mask
  sw t0, 0(t1)

  ... 省略 ...
  /* set main stack */
  la sp, _fstack

  /* 设置中断函数 */
  la t0, _irq
  picorv32_setq_insn(q2, t0)

  /* jump to main */
  jal ra, main

1:
  /* loop forever */
  j 1b
```

在跳转 main 函数之前，我们还设置了中断函数的位置 _irq，这一步其实并不是必要的。这个主要是因为我想把中断处理函数放在一个单独的 interrupt_gcc.S 文件里，不然 start.S 文件就太长了，我只希望把 CPU 初始化相关的代码放在 start.S 里面，看起来比较整洁，后面我会详细介绍中断。

这里还有一个好消息，其实 CPU 初始化的 start.S 代码 LiteX 也自动生成了，不同 CPU 的汇编初始化代码可以在 LiteX 仓库的 cpu 目录下找到，毕竟 CPU 初始化代码一般也都是由 CPU 的设计者提供，自己根据需要略微修改就可以了。

- [LiteX CPU 初始化代码](https://github.com/enjoy-digital/litex/tree/master/litex/soc/cores/cpu)



## 3. 主函数 main.c

利用汇编初始化 CPU 后，我们就可以用 C  编写 main 函数了，感觉一下就轻松了不少。

但是在实际写 C 代码前，我们还需要提供一个最小的 C 环境，也就是 libc。这个可以由编译器提供，但是 riscv64-gcc 编译器默认只提供 64 位的 libc，虽然 64 位的 riscv-gcc 支持编译生成 32 位的 riscv 代码，但是并不提供 32 位的 libc，直接编译就会报错不支持。所以 LiteX 甚至非常贴心地为我们准备了 libc，在生成 SoC 后可以在 build 目录下找到需要的 libc。

![img](https://doc.wuhanstudio.cc/posts/picorv32_boot/litex_libc.png)

不光 libc，LiteX 还无微不至地提供了驱动函数，例如定时器，i2c, SPI 等等，所以我们在使用了 LiteX 提供的这些 C 函数后，甚至可以直接调用 printf()。

下面的 main.c 看起来非常清晰，先包含 LiteX 提供的 libc 和 驱动函数，接下来打开中断，初始化串口，就可以反复打印 Hello World 了。

```
#include <stdio.h>

#include <irq.h>
#include <libbase/uart.h>

int main(void)
{
    // 打开中断
    irq_setmask(0);
    irq_setie(1);

    // 串口初始化
    uart_init();

    ... 省略定时器中断 ...

    // 打印 Hello World
    printf("Hello World \n");

    while(1)
    {
        if(timeup) {
            printf("Hello World %d\n", count);
            timeup = 0;
        }
    };

    return 0;
}
```

相信上面的 main.c 不需要过多的解释，不过我省略了定时器中断相关的代码，因为这是唯一需要特别小心的地方，我在下一个部分单独介绍。



## 4. 中断处理 IRQ

如果我们不使用定时器和中断，上面的代码就能反复打印 Hello World 了，但是嵌入式的乐趣也就在各种硬件资源 (timer, i2c, spi, irq)，所以我在这个部分单独介绍 picorv32 的定时器中断。

前面我们提到，在程序的 0x10 (16 字节) 处放置的是 picorv32 默认的中断处理函数，但是我不希望 start.S 函数太长，所以在这个中断处理函数里，没有实际的中断处理，只是让它跳转到 interrupt_gcc.S 里定义的中断函数。

```
// 0x10 位置保存中断函数
.org 0x00000010 # IRQ
_irq_vector:
  // 保存栈和寄存器
  addi sp, sp, -16
  sw t0, 4(sp)
  sw ra, 8(sp)

  // 跳转到其他文件里的中断函数
  picorv32_getq_insn(t0, q2)
  sw t0, 12(sp)

  jalr t0 // Call the true IRQ vector.

  // 恢复栈和寄存器
  lw t0, 12(sp)
  picorv32_setq_insn(q2, t0) // Restore the true IRQ vector.
  
  lw ra, 8(sp)
  lw t0, 4(sp)
  addi sp, sp, 16

  // 中断返回
  picorv32_retirq_insn() // return from interrupt
```

因此，也可以在 start.S 的初始化代码里看到这样的内容，这样就可以在 interrupt_gcc.S 里面定义 _irq 函数了：

```
// 设置实际的中断函数名为 _irq
la t0, _irq
picorv32_setq_insn(q2, t0)
```

另一方面，我们也不希望纯用汇编来写中断函数，那就太痛苦了，所以在 interrupt_gcc.S 里我们的目的是再一次跳转到 C 函数的中断处理。为了跳转到 C 中断处理，由于 picorv32 中断不会自动保存现场（寄存器状态），所以我们需要在汇编里手动保存寄存器和 stack 的状态，调用 C 的中断函数，在 C 函数返回后再手动恢复。

> 这也就是之前的文章里提到的，picorv32 硬件设计很简单，但是软件就要做很多处理了。

```
#include "custom_ops.S"

// 中断处理函数
 .global _irq
_irq:
  // 保存寄存器
  picorv32_setq_insn(q2, x1)
  picorv32_setq_insn(q3, x2)

  /* use x1 to index into irq_regs */
  lui x1, %hi(irq_regs)
  addi x1, x1, %lo(irq_regs)

  /* use x2 as scratch space for saving registers */

  /* q0 (== x1), q2(== x2), q3 */
  picorv32_getq_insn(x2, q0)
  sw x2,   0*4(x1)
  picorv32_getq_insn(x2, q2)
  sw x2,   1*4(x1)
  picorv32_getq_insn(x2, q3)
  sw x2,   2*4(x1)

  /* save x3 - x31 */
  sw x3,   3*4(x1)
  sw x4,   4*4(x1)
  ...
  sw x30, 30*4(x1)
  sw x31, 31*4(x1)

  // 更新需要处理的中断在 _irq_pending
  picorv32_getq_insn(t0, q1)
  la t1, (_irq_pending)
  sw t0, 0(t1)

  /* prepare C handler stack */
  lui sp, %hi(_irq_stack)
  addi sp, sp, %lo(_irq_stack)

  // 调用 C 中断函数
  jal ra, irq

  // 恢复寄存器
  lui x1, %hi(irq_regs)
  addi x1, x1, %lo(irq_regs)

  /* restore q0 - q2 */
  lw x2,   0*4(x1)
  picorv32_setq_insn(q0, x2)
  lw x2,   1*4(x1)
  picorv32_setq_insn(q1, x2)
  lw x2,   2*4(x1)
  picorv32_setq_insn(q2, x2)

  /* restore x3 - x31 */
  lw x3,   3*4(x1)
  lw x4,   4*4(x1)
  ...
  lw x30, 30*4(x1)
  lw x31, 31*4(x1)

  /* restore x1 - x2 from q registers */
  picorv32_getq_insn(x1, q1)
  picorv32_getq_insn(x2, q2)

  // 中断返回
  ret
```

我们首先在 main.c 主函数里初始化定时器和中断，至于定时器相关寄存器的配置，我们需要阅读 LiteX 生成的文档，在编译 SoC 的时候会在 build/doc 目录生成文档，例如这个页面就定义了各个中断位：

![img](https://doc.wuhanstudio.cc/posts/picorv32_boot/litex_int.png)

在 Timer0 的文档页面，我们可以看到应当如何设置定时器0相关的寄存器，因为这部分寄存器配置并没有遵循 RISC-V 的标准，但也比较简单，文档描述也非常清晰，所以就不详细介绍了。

![img](https://doc.wuhanstudio.cc/posts/picorv32_boot/litex_timer0.png)

这样我们就可以 照着文档配置定时器，我生成的 SoC 时钟是 CONFIG_CLOCK_FREQUENCY= 24_000_000 = 24MHz，所以把定时器的数值设置为 CONFIG_CLOCK_FREQUENCY 就是定时 1 秒，超时后会进入中断函数，并自动重装定时器的值。

```
// 打开全局中断
irq_setmask(0);
irq_setie(1);

// 打开定时器0中断
timer0_ev_enable_write(1);
irq_setmask(irq_getmask() | (1 << TIMER0_INTERRUPT));

// 设置定时器0计时1秒
timer0_en_write(0);
timer0_load_write(0);
timer0_reload_write(CONFIG_CLOCK_FREQUENCY);
timer0_en_write(1);
```

初始化完了定时器，我们终于可以用 C 写实际的中断函数了，用 C 写中断函数就非常简单，只是清除了对应的中断位，告诉 CPU 我们处理完中断了。

```
#include <stdio.h>

#include <irq.h>
#include <libbase/uart.h>

extern int volatile timeup;
extern int volatile count;

void irq(void)
{
    if(timer0_ev_pending_zero_read())
    {
        // 清除定时器中断处理位
        timer0_ev_pending_zero_write(1);

        // 主函数打印的数值 ++
        timeup = 1;
        count++;
    }

    if(uart_ev_pending_rx_read() || uart_ev_pending_tx_read())
    {
        // 串口中断处理
        printf("UART Interrupt \n");
        uart_isr();
    }

    return;
}
```

程序编译完后，我们就可以看到每隔1秒打印一个 Hello World，并且可以响应串口中断。

![img](https://doc.wuhanstudio.cc/posts/picorv32_boot/litex_output.png)



## 总结

虽然我们只是实现了一个定时打印 Hello World 和 串口中断，用现成的 MCU 和 SDK 可能分分钟就实现了，但是这个 MCU 是一个可以自定义的 SoC，我们可以根据需要给这个 SoC 灵活添加 i2c，SPI，UART 各种外设，甚至也可以给这个 SoC 换一个 CPU，反正 LiteX 会自动生成 CPU 的初始化代码，以及 libc 和基本的驱动代码。

另一方面，LiteX 这一套流程走下来，也对 CPU 指令集的设计，SoC 的综合，CPU 启动初始化，C 运行环境 和中断有了更深的理解，最后一步就是给这个 SoC 移植实时系统 RT-Thread Nano 了。

其实我三年前移植过了 picorv32 到 RT-Thread Nano，还可以使用 msh 控制台。不过一方面当时没有用 LiteX，而是 picorv32 的 Verilog 代码直接烧录到 FPGA，整个 SoC 不是那么灵活；另一方面，当时 **picorv32 的 Verilog 配置部分没有打开硬件中断，全部用的软件中断**。感兴趣的话下面链接是三年前不灵活的 picorv32，不过它的 RT-Thread 已经移植完成了。

- [RT-Thread on Picorv32 (无硬件中断)](https://github.com/wuhanstudio/picorv32_EG4S20)

所以最近决定更进一步，用 LiteX 定制一个更灵活的 SoC，还能运行 RT-Thread。