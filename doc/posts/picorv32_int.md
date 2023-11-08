Picorv32 中断 + 定时器 指令 (RISC-V)
=============================
> Picorv32 是一个只用 3000 行 Verilog 代码实现的 RISC-V CPU (RV32 IMC)。

最近在移植 LiteX 定制的 SoC (picorv32 CPU) 到 RT-Thread Nano，发现 picorv32 虽然是 RISC-V 的实现，但是**中断部分它没有遵循 RISC-V 的标准**：一方面 picorv32 没有中断向量表，需要在一个中断函数里，手动检测触发的是哪种中断，分别处理；另一方面，它还自己定义了一些指令，用来配置中断和定时器相关的寄存器。

我大胆猜测，这样做是因为 picorv32 的硬件设计可以偷懒，非常简单，但是软件部分就比较痛苦了。不过我也借这个机会学会了怎么**在 C 和汇编里插入 gcc 编译器不存在的指令**（虽然需要用到这个魔幻技能的机会，除了专用硬件，非常不常见）。



## 1 RISC-V 指令集格式 (R-type)

那么直接进入重点，picorv32 虽然自定义了中断相关的指令 (instruction)，但也不是完全瞎设计，还是遵循了 RISC-V 的 R-type 格式。

这里简单介绍一下 RISC-V 的指令集格式，picorv32 是 32 位的 CPU，并且指令和数据都是等长的 32 位。在 CPU 的眼里看来，一段编译后的程序就长这样，一串又一串32位的二进制数：

```
# RISC-V Program
00000010000000000000000000110011
00000000000000000000000000010011
00000000000000000010000000100011
```

那么问题来了，那 CPU 要如何区分一个32位的二进制数是指令 (instruction) 还是数据 (date) 呢？一方面我们把指令和数据保存在不同的位置 (.text .data)，另一方面 **RISC-V 也规定了指令的格式：R-type, I-type, S-type, SB-Type, U-type, UJ-type，只有遵循这种格式才会被 CPU 识别为指令 (instruction)，这些指令都是等长的 32 位**。

![img](https://doc.wuhanstudio.cc/posts/picorv32_int/riscv-isa.png)

例如 picorv32 就是在遵循 RISC-V 规定的 R-type 格式的前提下，**自定义了一些 R-type 的指令**：getq, setq, retirq, maskirq, waitirq [1] 用来配置中断相关的寄存器，所以 picorv32 自定义的指令都是下面这种格式（后面会介绍指令的每一位代表什么含义）：

```
RISC-V 指令一共32位：
(f7 7位，rs2 5位，rs 5位,f3 3位，rd 5位,opcode 7位)
7 + 5 + 5 + 3 + 5 + 7 = 32

------- 00000 XXXXX --- XXXXX -------
f7      rs2   rs    f3  rd    opcode

picorv32 自定义的 R-type 指令：
getq:    0b0000000, 0b000000, regnum_rs, 0b100, regnum_rd, 0b0001011
setq:    0b0000001, 0b000000, regnum_rs, 0b010, regnum_rd, 0b0001011
retirq:  0b0000010, 0b000000, 0b00000,   0b000, 0b00000,   0b0001011
maskirq: 0b0000011, 0b000000, regnum_rs, 0b110, regnum_rd, 0b0001011
waitirq: 0b0000100, 0b000000, regnum_rs, 0b100, regnum_rd, 0b0001011
timer:   0b0000101, 0b000000, regnum_rs, 0b110, regnum_rd, 0b0001011
```

### 1.1 RISC-V opcode (7位)

这里简单解释一下 32 位的组成，你会发现上面指令最后面的7位 opcode (0b0001011) 都是相同的，这表明这一系列的指令都是 picorv32 自定义的，下面是 RISC-V 原生的指令，用 7位的 opcode 来区分不同指令类型：

```
R-type: 0110011
I-type:  0000011
S-type:  0100011
SB-type: 1100111
U-type:  0110111
UJ-type: 1101111
picorv: 0001011
```

那么问题就来了，既然 picorv32 自定义的指令也是 R-type 的，**为什么 opcode 没有用 RISC-V 标准规定的 R-type:  0110011，而是用了自定义的 0001011 呢？**我只能大胆猜测，这么做是为了提醒自己这部分 R-type 不是 RISC-V 的标准，在其他 RISC-V CPU 上执行这些指令就会报错：非法指令，所以找了一个还没有被用过的 opcode 用来区分自定义指令和标准指令。

### 1.2 RISC-V func (3+7=10位)

除去 7 位的 opcode 用来区分不同的指令类型，我们还可以用 f3 和 f7 一共 10 位细分指令，比如 R-Type 的指令还有 add, sub, xor, or, and 等等，下面第三列的 opcode 都是一样的，表明它们都是 R-type 指令，再利用 3位的 f3 和 7 位的 f7 帮助 CPU 区分它们是 add, sub, xor, or 还是 and：

![img](https://doc.wuhanstudio.cc/posts/picorv32_int/riscv-func.png)

### 1.3 RISC-V rs rs2 rd (3x5=15 位)

这样 RISC-V 32位的指令，除去7位的 opcode 和 10位的 func，还剩下15位 (rs2, rs, rd)，分别表示 register source (rs) 和 register destination (rd)。

```
------- 00000 XXXXX --- XXXXX -------
f7      rs2   rs    f3  rd    opcode
```

它们仨各占 5位 刚好一共15位，因为 RISC-V 一共有 32 个通用寄存器，rs2, rs, rd 其实就代表了通用寄存器的序号，我们可以用 5 bit 二进制数来索引 32 个通用寄存器 (2^5=32)，所以它们各占5位。

![img](https://doc.wuhanstudio.cc/posts/picorv32_int/riscv-reg.png)

RISC-V 的32个通用寄存器，有些有特殊用途，例如 rd = 0b00001 就代表第一个寄存器 x1，通常作为函数返回的地址；rd = 0b00000 则代表第零个寄存器，**这个寄存器 x0 的值永远是 0**，这么特地设计一个 0 寄存器 的原因是我们会经常需要 0 来初始化寄存器，一方面访问 CPU 内部的通用寄存器 x0 比访问外部数据速度更快，另一方面 R-type 的指令都是在寄存器 (Register) 之间操作的 (rs, rd)，这样有一个 x0 寄存器，我们使用 R-type 指令的时候让 rs = x0 是合法操作，它俩都是寄存器；而 rs = 0 则是非法操作，左边是寄存器，右边是立即数。所以引入一个 x0 寄存器可以简化很多操作。



## 2 Picorv32 自定义指令

在熟悉了 RISC-V 的 R-type 指令后，我们再来看 picorv32 自定义的中断指令，就会非常亲切了：

```
picorv32 自定义的 R-type 指令：
指令名称---7位f7-----5位rs2----5位rs1---3位f3---5位rd-----7位opcode
getq:    0b0000000, 0b00000, regnum_rs, 0b100, regnum_rd, 0b0001011
setq:    0b0000001, 0b00000, regnum_rs, 0b010, regnum_rd, 0b0001011
retirq:  0b0000010, 0b00000, 0b00000,   0b000, 0b00000,   0b0001011
maskirq: 0b0000011, 0b00000, regnum_rs, 0b110, regnum_rd, 0b0001011
waitirq: 0b0000100, 0b00000, regnum_rs, 0b100, regnum_rd, 0b0001011
timer:   0b0000101, 0b00000, regnum_rs, 0b110, regnum_rd, 0b0001011
```

在标准 R-Type 的基础上，picorv32 遵循标准的同时，选择了标准指令没有占用的 f7，f3 和 opcode 用来区分自己定义的指令；另外 rs2 和 rs 都是 Register Source，一个是冗余预留的，我们不需要 2 个，所以上面 rs2 都固定成了 0b00000，剩下的 rs 和 rd 就是汇编指令的参数了。

### 2.1 汇编 自定义指令集

虽然自定义指令集看起来非常厉害，大大简化了硬件设计。可是问题在于这些非标准的指令集 gcc 编译器并不认识，也不会自动编译生成这些指令集，软件的设计就会很头疼了。**我们需要把自定义的 picorv32 中断指令插入到 C 和汇编代码里。**

好在 picorv32 的官方仓库里其实也给了 custom_ops.S 的例子：

```
From https://github.com/YosysHQ/picorv32/blob/master/firmware/custom_ops.S:

#define r_type_insn(_f7, _rs2, _rs1, _f3, _rd, _opc) \
.word (((_f7) << 25) | ((_rs2) << 20) | ((_rs1) << 15) | ((_f3) << 12) | ((_rd) << 7) | ((_opc) << 0))
```

![img](https://doc.wuhanstudio.cc/posts/picorv32_int/riscv-r-format.png)

上面的代码其实就是定义了 R-type 指令，可以看到首先定义 r_type_insn，**其中 insn 代表 instruction（很遗憾，为什么不用 inst 缩写)**，配合我们前面介绍的 32 位 R-type 组成 (f7, rs2, rs1, f3, rd, opcode)，上面的代码就是将 f7, rs2, rs1, f3, rd, opcode 左移不同位，组成一个完整的 32 位 .word。

接下来我们还需要固定 f7, rs2, f3, opcode 来定义 picorv32 的指令，以 getq 指令为例，下面的代码其实就是固定了 f7=0b0000000，rs2=0b00000，f3=0b100，opcode=0b0001011。

```
#define picorv32_getq_insn(_rd, _qs) \
r_type_insn(0b0000000, 0, regnum_ ## _qs, 0b100, regnum_ ## _rd, 0b0001011)
```

到这里为止，我们就可以在汇编里调用 picorv32_getq_insn(_rd, _qs) 函数来使用自定义的指令集了。

最后就是依葫芦画瓢，下面是完整的 picorv32 自定义指令的汇编定义，相信了解 RISC-V 的 32 位 R-type 指令设计后，再看下面的代码豁然开朗。

```
// custom_ops.S

// 标准的 RISC-V 规范 R-type
#define r_type_insn(_f7, _rs2, _rs1, _f3, _rd, _opc) \
.word (((_f7) << 25) | ((_rs2) << 20) | ((_rs1) << 15) | ((_f3) << 12) | ((_rd) << 7) | ((_opc) << 0))

// picorv32 自定义指令
#define picorv32_getq_insn(_rd, _qs) \
r_type_insn(0b0000000, 0, regnum_ ## _qs, 0b100, regnum_ ## _rd, 0b0001011)

#define picorv32_setq_insn(_qd, _rs) \
r_type_insn(0b0000001, 0, regnum_ ## _rs, 0b010, regnum_ ## _qd, 0b0001011)

#define picorv32_retirq_insn() \
r_type_insn(0b0000010, 0, 0, 0b000, 0, 0b0001011)

#define picorv32_maskirq_insn(_rd, _rs) \
r_type_insn(0b0000011, 0, regnum_ ## _rs, 0b110, regnum_ ## _rd, 0b0001011)

#define picorv32_waitirq_insn(_rd) \
r_type_insn(0b0000100, 0, 0, 0b100, regnum_ ## _rd, 0b0001011)

#define picorv32_timer_insn(_rd, _rs) \
r_type_insn(0b0000101, 0, regnum_ ## _rs, 0b110, regnum_ ## _rd, 0b0001011)
```

### 2.2 C 自定义指令集

最后剩下的问题就是，怎么在 C 函数里面调用汇编指令呢？

通常我们没有必要为一个汇编指令单独定义一个函数，比如我们希望禁用 picorv32 的中断，需要把中断位全部设置为1 (picorv32 中 1:disable, 0: enable)，我们可以调用前面定义的汇编指令 picorv32_maskirq_insn(zero, 0xFFFFFFFF) 来屏蔽所有中断。

这样，我们可以在汇编文件里定义一个函数 **_irq_disable()**，分两步完成：首先将立即数 0xFFFFFFFF 放到一个寄存器 t0 里，再调用 picorv32 的自定义 R-type 指令将寄存器 t0 存入中断寄存器里。

> 如果我们有一个寄存器全是1，那我们就可以一步完成，不需要先将立即数 0xFFFFFFFF 放到寄存器里了，这也是前面提到为什么 RISC-V 有一个 x0 永远是0的寄存器的原因。

```
From https://github.com/wuhanstudio/litex-soc-icesugar-rust/blob/picorv32/demo/interrupt_gcc.S
/*
 * Disable interrupts by masking all interrupts (the mask should already be
 * up to date)
 */
.global _irq_disable
_irq_disable:
  /* Mask all IRQs */
  li t0, 0xffffffff
  picorv32_maskirq_insn(zero, t0)
  ret
```

> 友情提醒，上面的 picorv32_maskirq_insn() 就是之前在 custom_ops.S 汇编文件里 picorv32 自定义的 maskiqr 指令（RISC-V 标准的 R-type）。

最后就能直接在 C 文件里调用函数 **_irq_disable()** 了。

```
// 函数定义来自汇编
extern void _irq_disable(void);

int main()
{
    _irq_disable();
    return 0;
}
```



## 总结

看完这篇文章，应当就熟悉了 picorv32 如何在遵循 RISC-V 规定的 R-type 指令的前提下，自定义了一些中断指令，以及怎么在汇编和C函数里调用 gcc 无法识别的自定义指令。

最后可能有人会问，我确实熟悉了 picorv32 CPU 的设计，那么哪里有 picorv32 的开发板可以测试呢？我是在 ICEsugar 开发板 (Lattice FPGA) 上用 LiteX 生成的 SoC，也就是跑的软核 picorv32。

本来我还打算介绍 picorv32 的启动流程，但是这篇文章已经很长了，可能得单独写一篇文章介绍 picorv32 的启动流程和 RT-Thread Nano 操作系统的移植了。



## References

[1] Picorv32 official GitHub repo: https://github.com/YosysHQ/picorv32#custom-instructions-for-irq-handling