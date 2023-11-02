CRYPTO1: 密码分析学 (门禁卡破解)
============================

> 介绍 NXP 公司的 NFC 卡加密认证破解过程

从 2015 年开始，在国内读本科的时候就有不少同学破解、复制了门禁卡、校园卡。如今已经过去了 8 年，2023 年到英国读博了，不论是学校宿舍，还是市中心宿舍的门禁卡，依旧可以随意破解、复制，甚至伦敦地铁的 Oyster Card 也是同款不安全的设计。

![img](https://doc.wuhanstudio.cc/posts/oyster.png)

1994 年，NXP 发布了这款不安全的 NFC 卡（ MIFARE Classic EV11K 也称为 M1 卡），接下来风靡全球，公交卡、地铁卡、门禁卡、学生卡都得到了广泛的应用。当然，这张卡的认证、加密算法都是不对外公开的，当初并没有人知道它是不安全的。

直到 2008 年，才有人利用逆向工程完整复原了卡的所有加密细节，并且公布了一些针对认证过程（Authentication）的攻击 [1]，不过这些攻击并没有威胁到它的核心 Crypto1 加密算法。之后 NXP 公司紧急修复了认证过程的一些漏洞，表示还能继续使用。

2015 年，很不幸密码分析学得到了发展之后，它的核心 Crypto1 加密算法也被完全破解了 [2]，NXP 公司只好宣布今后不再使用这张卡。

然而如今 2023 年，只需要1分钟左右就能完整破解的 M1 卡依旧风靡国内外，它的生命周期已经持续了近 30 年。

NXP 的 M1 卡算是密码学应用一个非常有意思的反面教材了，这篇文章会详细介绍 M1 卡的设计，以及是如何一步一步被破解的。

我会先介绍 NFC 破解相关的软硬件，接下来介绍 M1 卡的数据存储和认证加密方式 (Authentication & Encryption)，最后介绍三种分别针对 UID, Authentication, Encryption (Crypto1) 的攻击方式。

## 介绍：NFC 开源软硬件

如果只是希望迅速实践，破解手边的一张门禁卡，有 2 个选择：一是买一个 PN532 模块，配合 Github 的 mfoc 程序，一行命令，一分钟就能破解复制。

![img](https://doc.wuhanstudio.cc/posts/crypto1/pn532.png)

- [GitHub: mfoc-hardnested](https://github.com/nfc-tools/mfoc-hardnested)

```
# pn532 + mfoc 破解命令
$ sudo mfoc-hardnested -O mycard.mfd
```

或者买一个 Proxmark 3，也能在一分钟左右迅速破解 M1 卡。

![img](https://doc.wuhanstudio.cc/posts/crypto1/proxmark.jpg)

- [GitHub: Proxmark3](https://github.com/RfidResearchGroup/proxmark3)

```
# Proxmark 破解命令
$ hf mf autopwn
```

具体的实践教程 GitHub 项目有文档，安装好软件后破解也就只需要上面一行命令，这里就不详细演示了，接下来主要介绍 M1 卡的 Authentication 和 Encryption 的设计，以及如何逆向工程还原内部设计和破解的。

## 介绍：M1 卡数据存储

首先介绍一下 M1 卡的设计，可以把它看作一个带 ID 的容量特别小的 U 盘（只有 1KB = 1024 Byte）。

如果作为门禁卡使用，1KB 存储房间信息足够了。除了存储之外，每张卡还有一个全球唯一的 ID，所以即使不存储房间信息，也可以光靠匹配这个 ID 进行认证。当然这是不安全的，然而曾经华科宿舍、图书馆的门禁系统也确实是这么不安全地设计的。

现在 M1 卡可以做得特别小，甚至可以像贴纸一样直接贴在手机背后。

![img](https://doc.wuhanstudio.cc/posts/crypto1/sticker.png)

如果我们看一下它的内部构造，其实就是一个线圈 + 芯片。当 NFC 卡接近读卡器的时候，读卡器就会通过线圈给卡片里的芯片供电，读取它的 ID 和数据。这里顺便一提，M1卡的工作频率是高频 13.56MHz，早期也有一些不带存储功能的卡，只能读全球唯一的 ID，那种卡的工作频率通常在低频 125KHz。 

![img](https://doc.wuhanstudio.cc/posts/crypto1/coil.jpg)

例如可以用 proxmark 的命令读取 M1 卡的 ID：

```
$ hf search
```

![img](https://doc.wuhanstudio.cc/posts/crypto1/hf-search.png)

可以看到这张卡的 UID  有 4 个字节： 0xDC 0x23 0xAB 0x11，同样我们也可以读取卡内 1K 的数据，当然卡内的数据是经过加密的，一共可以存储 1K = 1024 Byte。下面图上就是一张空卡的一个区块的数据 (64 Byte)：

![img](https://doc.wuhanstudio.cc/posts/crypto1/mfc-block.png)

例如，十六进制 FF 代表二进制 1111 (F) 1111 (F)， 一共有 8 位（bit），也就是 1 个 Byte。

上面这张图，一行有 16 个 FF，也就是 16 个 Byte。图上一共有 4 行，也就是 16 x 4 = 64 Byte。前面我们提到，一张 M1 卡有 1024 Byte  的存储空间，1024 = 16 * 64，所以可以推出来，一张卡有 16 个上面这张图的区块，下面就是一张完整的卡的数据：

![img](https://doc.wuhanstudio.cc/posts/crypto1/mfc-data.png)

如果你耐心地数一数，一共有 64 行，每行 16 Byte  刚好是 64 x 16 = 1024 Byte，也就是 M1 卡的全部 1KB 数据。

到这里介绍了 M1 卡有一个全球唯一的 UID 和 1KB  的存储数据，下面会介绍这 1KB 的数据是如何加密的。



## 介绍：M1 卡数据加密

M1 卡的 UID 是全球唯一，不可修改，不过没有经过加密，可以随意读取的，而 1KB 的数据则是经过加密的。虽然 M1 卡有全球唯一的 UID 和 1KB 的存储，但是也有不少应用为了图简单，并不读取卡内的数据，只是匹配卡的  UID 就通过门禁。

前面提到，1024 Byte 的数据分为 16 个区块，每个区块 64 个 Byte。这 16 个区块是分别加密的，也就是说可以分别为每个区块设置不同的密钥，M1 卡的密钥又分为 Key A 和 Key B。如果要完整读取一张卡的数据，需要知道全部的 16 组密钥。

![img](https://doc.wuhanstudio.cc/posts/crypto1/mfc-block.png)

有意思的是，密钥是直接存储在对应的区块 (Block) 里的，比如上面图里的最后一行，就是这个区块的密钥。

最后一行有 16 Byte，前 6 个 Byte 是 Key A，后 6 个 Byte 是 Key B，中间的 4 个 Byte 的控制位，决定我们读写数据的权限。因此，这张默认白卡的 Key A 是前 6 个 Byte：FF FF FF FF FF FF，默认的 Key B 是后 6 个 Byte：FF FF FF FF FF FF。

![img](https://doc.wuhanstudio.cc/posts/crypto1/mfc-key.png)

> M1 卡完全破解需要 16 组 Key A 和 Key B

我们可以设置控制位，例如有 Key A 的人只能读取数据，不能修改密钥；有 Key B 的人，既可以读取数据，也可以修改密钥。这里不详细介绍控制位，因为这是应用方面的设计，和加密机制无关。

M1 卡的加密机制分为两个部分，认证 (Authentication) 和 加密 (Encryption)。认证过程读卡器需要确定卡的型号，读取卡的 UID，选择要读取的扇区，以及交换信息用于后面的加密。

### 1. Authentication

不过这个认证过程并不是 NXP 公司特有的，而是遵循 ISO14443-A 的规范。然而 M1 卡并没有完全遵循这个规范，也因此有了一些设计上的漏洞。

例如下面的通讯流程，**我们用 Tag (T) 表示 NFC 卡，用 Reader (R) 表示读卡器**。上电后先执行一些非加密通讯：例如读 UID，选择要读取的 Block。为了进行加密通讯，Tag 会先发送一个 Nonce 用 $n_T$ 表示，Reader 收到来自 NFC 卡的 $n_T$ 之后，会发送自己的响应 $a_R$ 来表明自己是合法的读卡器。同时，读卡器也会发送自己的 Nonce  用 $n_R$ 表示，在收到 NFC 卡的合法相应 $a_T$ 之后，就互相验明身份，愉快地开始加密通讯了。

简而言之，NFC 卡发送 $n_T$ 收到 $a_R$ ，读卡器发送 $n_R$ 收到 $a_T$，互验身份。 

![img](https://doc.wuhanstudio.cc/posts/crypto1/crypto1-auth.png)

### 2. Encryption

前面提到，M1 卡的加密算法 Crypto1 是不对外公开的，后面被逆向工程破解后公开的。

之前一篇密码学的文章提到，加密分为 **对称加密** 和 **非对称加密**，对于轻量级的嵌入式应用，并没有足够的算力跑非对称加密，所以都是用 **对称加密** 加密实际的数据，**非对称加密** 则是用来生成密钥对。

M1 卡则是出场默认密钥 Key A 和 Key B，后面也可以用默认的密钥修改 Key A 和 Key B，所以 M1 卡的加密过程不需要在芯片上生成密钥，直接使用 Crypto1 加密就可以了。对称加密 分为 **块加密 (Block Cipher)** 和 **流加密 (Stream Cipher)**，而 Crypto1 属于 流加密 (Stream Cipher)。

我们弄清 M1 卡分为 Authentication 和 Encryption 两部分之后，接下来介绍 M1 卡是怎样被逆向工程破解的。



## 破解1：UID 复制

首先，最简单的破解是 UID 的复制。之前介绍过，虽然 M1 卡有全球唯一的 UID 和 1KB 的存储，但是也有不少应用为了图简单，并不读取卡内的数据，只是匹配卡的  UID 就通过门禁。

正常情况下，按照规矩，M1 卡的 UID 是出厂的时候就固化的，不能进行修改。但是不知道什么时候起，万能的中国厂商在生产某些 M1 卡的时候，留了后门，可以通过后门程序非法修改 UID。这也就意味着可以克隆一张 M1 卡的 UID 了，如果门禁系统又恰好只认证 UID，那么我们就可以非法通过了。

下面是用 Proxmark 检测一张 M1 卡是不是留有中国特色后门，这种留有后门的卡称之为 Magic Card：

```
$ hf search
```

![img](https://doc.wuhanstudio.cc/posts/crypto1/mfc-magic.png)

当然，并不是所有中国生产的 M1 卡都留有后门的，需要专门买可以修改 UID 的卡，最早不知道 M1 卡内部的加密算法的时候，就是通过中国特色后门来复制 UID 破解门禁的。



## 破解2：Authentication

由于 NXP 并没有公开算法细节，最开始破解只能通过 FPGA 抓包的形式，分析可能的内部设计。不过也不是一无所知，加密算法的设计也是有标准的，例如高效的硬件加密通常会用 LFSR 组合生成 Keystream。 

2015  年，Garcia et al. 通过监听数据包，完全复原了 Crypto1 的设计，为此 NXP 还将论文作者告上了法庭，阻止这篇论文的发表 [1]。当然，最后论文还是顺利发表了。

为了复原 Authentication 的流程，我们需要用 Proxmark 模拟一个 M1 NFC 卡，和读卡器进行通讯。因为是 Proxmark 模拟的 NFC 卡，我们可以随意控制卡的 ID 以及通讯流程。Authentication 的目的是为了让 NFC 卡和读卡器能互相验证身份，同步初始化加密模块的状态，这样就可以生成相同的 keystream 用于通信（如果这里不清楚，可以回顾一下 Stream Cipher）。

这里再重复说明一下认证流程：**我们用 Tag (T) 表示 NFC 卡，用 Reader (R) 表示读卡器**。上电后先执行一些非加密通讯：例如读 UID，选择要读取的 Block。为了进行加密通讯，NFC 卡发送 $n_T$ 收到 $a_R$，读卡器发送 $n_R$ 收到 $a_T$，互验身份。 

![img](https://doc.wuhanstudio.cc/posts/crypto1/crypto1-auth.png)

这个认证过程的漏洞在于，NFC 卡 PRNG (伪随机数发生器) 生成的 Nonce 是可以预测的，每次上电后只要经过的时间相同， 生成的 $n_T$ 都是固定的。于是我们就可以修改模拟卡的 UID，反复生成相同的 $n_T$ 来看读卡器的反应，并且 Garcia 发现，只要 $n_T  \oplus uid$ 的值相同，图上 09 行读卡器加密后的相应 $n_R\oplus ks_1$ 就是固定的。

前面提到，我们可以通过控制上电的时间，让每次生成相同的 $n_T  \oplus uid$ 和 keystream，例如图上第10行，我们从读卡器得到了2个不同的加密响应 $a_T \oplus ks_3$ 和 $a_T^{'}  \oplus ks_3$ ，虽然用来加密的 $ks_3$ 是未知的，我们把它们相加就互相抵消了 $a_T\oplus ks_3 \oplus a_T^{'}\oplus ks_3 = a_T \oplus a_T^{'} \oplus ks_3 \oplus ks_3$，因为 $ks_3 \oplus ks_3 = 0$ ，我们就得到了没有加密的 $a_T \oplus a_T{'}$，其中 $a_T$ 代表卡 Tag (T) 的相应 Answer (a)。

除了前面提到的 PRNG 生成的序列和上电时间有关，是可以控制的。一些读卡器在图上第 8 行的时候，如果 NFC 卡什么也不发送，读卡器超时后在第 9 行会返回一个关机命令 halt $\oplus ks_3$ 。然而不幸的是，halt 命令是由 ISO1443 规定的已知值，这样我们已知 halt 和 halt $\oplus ks_3$，意味着我们可以计算得到 $ks_3$ 从而恢复一部分 keystream。

当然，Authentication 还有很多其他的漏洞，例如 Nested Authentication，M1 卡一共有 16 个 Block，我们可以在知道某一个 Block 的密钥后，用它来认证其他的 Block。打个比方，通常 NFC 内部的 1K 存储不会全部用完，这就意味着有些 Block 会使用默认的密钥 FF FF FF FF FF FF，我们就可以利用这些 Block 默认的密钥来认证其他的 Block。

最后有了足够多的 keystream，我们就可以还原内部 Crypto1 的  LFSR 设计了。

**尽管 Authentication 部分的漏洞很多，这些漏洞不涉及核心加密算法，是可以打补丁修复的**，例如前面提到的可以利用已知的 halt 指令得到 $ks_3$ ，只要读卡器超时不发送 halt 指令就修复了漏洞。NXP 也确实修复了几次 Authentication 的漏洞，不过不断又有新的漏洞被发现。



## 破解3：Crypto1

前面提到，Authentication 的漏洞可以通过打补丁修复，只要没有威胁到核心的 Cryto1 算法，M1 卡打打补丁又能用。 然而，非常不幸的是，2015 年 M1 卡的核心 Crypto1 算法也被成功破解了 [2]，攻击者可以在一分钟内搜寻得到密钥，这也彻底宣告了 M1 卡的终结，虽然实际上直到 2023 年国内外依旧还在用 M1 卡。

早期不知道 Crypto1 算法细节的时候，只有 读卡器 和 M1 卡有硬件的算法实现，但是毕竟这两个设备计算能力都不强，利用它们进行遍历，暴力破解 (Brute Force) 的话计算速度实在太慢，再加上 Authentication 的一些延迟，尝试一次可能需要花费 0.5 秒。

然而 Crypto1 的算法细节被公开后，我们可以在高性能的计算机上进行暴力破解。如果使用前面提到的 mfoc 暴力破解，在个人笔记本上 (i5 八核) 大约只需要 2 个小时左右。

更让 NXP 绝望的是，在 2015 年，密码分析学快速发展多年后，Carlo Meijer 找到了 Crypto1 核心加密算法的漏洞 [2]，从此破解 M1 卡只需要一分钟左右 (mfoc-hardnested)，彻底宣告了 M1 卡的终结。 

![img](https://doc.wuhanstudio.cc/posts/crypto1/crypto1-init.png)

上面这张图是 Crypto1 Stream Cipher 的初始化过程。在 Crypto1 加密细节公开后，对于一个 Stream Cipher 而言，只要能弄清内部状态是如何初始化的，我们就能生成一模一样的 keystream。

图上可以看到，Crypto1 是利用 ( $K$, $uid \oplus n_T$, $n_R$) 来初始化内部状态的，这也是为什么前面提到，只要  的值相同，  就是固定的 (由于 PRNG 的漏洞，我们可以通过控制上电时间生成一样的 Nonce)。

如果我们有一张要复制的 M1 卡，用来初始化内部状态的 ( , , ) 几个参数中，它的密钥 $K$ 和 UID 都是固定的。由于我们已经知道了 Crypto1 的算法细节，我们可以通过收集一些 Nonce，来反复初始化 Crypto1 的状态，通过遍历尝试 $2^{39}$ 种可能的密钥 $K$，如果生成的  keystream 一模一样，说明我们尝试对 $K$ 了。但是尝试 $2^{39}$ 种可能实在是太慢了，有没有办法减少需要尝试的 $K$ 数量呢？

下面这张图是 Crypto1 生成 Keystream 的流程，我们可以看到它竟然只用奇数位生成 Keystream，例如 9,11,13,15 ... 47 位。我们这样就可以把奇数位和偶数位分开，例如先固定 20 位偶数位，再固定 19 位奇数位，这样就只需要尝试 $2^{20} + 2^{19} = 1572864 \approx 2^{20.58}$ 种可能。

假如在 CPU 上计算，尝试一种可能需要 5ms (实际会更快)， $1572864 * 5 = 7864320$ 毫秒，大约只需要 2 小时，这已经是可以接受的破解时间了。

![img](https://doc.wuhanstudio.cc/posts/crypto1/crypto1-stream.png)

然而，通过分析加密后的密文，可以进一步将搜寻空间从 $2^{20.58}$ 进一步减少，利用 Sum Property [2] 和 Filter Flip [3]，最终只需要1分钟内就能找到正确的密钥。

这里我们总结一下，破解的流程分为 3 步：

1. 利用 Nested Authentication 漏洞，搜集足够多的 Nonce。例如，M1 卡有 64 个 Block，不一定全部存满了数据，没有记录数据的 Block 通常用的出厂默认密钥，我们可以通过认证这个 Block 来读取别的未知 Block 数据。
2. 利用 Sum Property 和 Filter Flip 来减少搜寻空间，减少可能的密钥数量
3. 在电脑上暴力破解，遍历剩余可能的所有密钥。

其中，第一步利用了 Authentication 的漏洞，最后一步是因为 Crypto1 的算法加密细节被逆向工程完全公开，导致我们可以在高性能计算机上快速尝试可能的密钥。**最重要的是第二步，Sum Property 和 Filter Flip 大大减少了搜寻空间**，以至于我们可以在个人笔记本上，只花1分钟就能计算完所有剩余的密钥。

这里简单介绍一下两个突破：Sum Property 和 Filter Flip，它们都是为了减少密钥  的搜寻空间。

### 1. Sum Property

对于一个 32 位的 $n_T$，我们可以把它分成 4 个字节 (Byte)，然后分别对每一个字节分析。

每一个字节有 8 位，也就是 256 种可能性。如果我们在收集 Nonce 的过程中，收集到了  某一个字节的这 256 种可能性。我们把这一个字节按位进行 XOR $\oplus$ 运算，得到 1 位的输出，再和奇偶校验位 (Parity) 进行 XOR（注意这里的校验位 $p_i$ 是和 keystream 进行了 XOR 运算后加密的），最终得到 1位 (bit) 的输出。由于我们对 256 种可能性进行计算，每种可能性计算得到的 1 bit 结果只能是 0 或者 1， 所以 S 最大是 256，最小是 0。

![img](https://doc.wuhanstudio.cc/posts/crypto1/sum-property.png)

 我们可能以为 S 的分布是比较均衡的，实际上可以看到在统计了 8192 个 Crypto1 的状态后，发现 S 并不是 [0, 256] 每种可能性都存在，甚至有些值，例如下图的 128 概率异常地高，这也就告诉我们 Crypto1 输出的 keystream 是存在某种概率分布的，这样我们就可以用 Cryptanalysis 的一些方法进行分析，剔除掉可能性非常低的密钥 $K$，减少搜寻空间。

![img](https://doc.wuhanstudio.cc/posts/crypto1/sum-property-value.png)

实际操作时，由于之前提到 Crypto1 的加密算法用到的 Filter Function 只利用了奇数位，我们可以把奇偶位的 Sum Property 分开计算。

![img](https://doc.wuhanstudio.cc/posts/crypto1/filter-function.png)

只有满足下面公式 $s=p(16-q)+q(16-p)$ 的 Ctypto1 内部状态才是有效的，于是我们就可以剔除掉很大一部分搜寻空间。

![img](https://doc.wuhanstudio.cc/posts/crypto1/lamma.png)

### 2. Filter Flip

Crypto1 Stream Cipher 在生成最终用来加密的 keystream 前，需要把内部 48 位的状态通过一个非线性 Filter Function，也就是下面这张图定义的。

![img](https://doc.wuhanstudio.cc/posts/crypto1/crpyto1-filter.png)

Garcia 发现，上面的 Filter Function 满足下面的特性：如果两个 32 位的 $n_T$ 和 $n_T^{'}$，如果前面 3 个字节 (byte) 都一样，只反转最后一位 (bit)，并且最终的奇偶校验位 $\{p_i\}$ 和 $\{p_i^{'}\}$ 也是一样的，那么它们经过 Filter Function 后的输出必然是不同的：$f(\alpha_{8i+8}) \neq f(\alpha_{8i+8} \oplus 1) $。 

![img](https://doc.wuhanstudio.cc/posts/crypto1/lamma-5-10.png)

Garcia 通过实验表明，整个搜寻空间中，大约只有 9.4% 的输入有这个特性，于是每次观察到搜集的 Nonce 出现了 Filter Flip，我们就可以进一步缩小搜寻空间，只暴力破解满足这个特性的 9.4% 个输入。



## 总结

最后总结一下，尽管 NXP 在 1994 年发布的时候，并没有公开 M1 卡加密的细节，最终在 2008 年被人利用 PRNG 的漏洞，找到了 Authentication 设计的纰漏。因为没有破解核心的 Crypto1 算法，NXP 迅速打补丁修复 Authentication 的漏洞，勉强维持了 M1 卡的安全性。然而终于还是在 2015 年被人利用密码分析学，分析密文的特征，成功在 1 分钟左右破解得到密钥，也彻底宣告了 Crypto1 生命的终结。

> The paradox of keeping things secret.

NXP 设计的 M1 卡在发布 20 年后终于被完全破解的故事，告诉我们 **千万不要使用未经公开的加密算法** (例如 NXP 偷偷设计的 Crypto1)，只有算法加密细节完全公开，并且经过学术界、工业界研究多年，仍未找到比 暴力破解 (Brute Force) 显著更优的破解方式，才是真正的安全。



## 参考资料

[1] Garcia, Flavio D., et al. "Dismantling MIFARE Classic."*ESORICS*. Vol. 5283. 2008.

[2] Meijer, Carlo, and Roel Verdult. "Ciphertext-only cryptanalysis on hardened Mifare classic cards."*Proceedings of the 22nd ACM SIGSAC Conference on Computer and Communications Security*. 2015.

[3] Garcia, Flavio D., et al. "Wirelessly pickpocketing a Mifare Classic card."*2009 30th IEEE Symposium on Security and Privacy*. IEEE, 2009.