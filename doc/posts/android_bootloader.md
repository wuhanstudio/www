Android 解锁 Bootloader (Magisk + Root)
===================================

> The Big Brother is watching you using Android.  -- 1984

众所周知，国产 Android 手机 (包括鸿蒙) 正在开启大监控时代，一旦安装了 反诈 App，就会持续监控手机通信、App、网络，即使卸载了也会在后台持续运行，唯一的解决办法就是重装没有 Big Brother 的系统。

除了监控软件，海外也有人担心 Google 过度绑定了用户信息，于是诞生了开源的 Lineage OS (Android)，移除了所有的 Google 组件，是一个非常清爽的手机系统。除此以外，还有 Ubuntu Phone 等开源手机。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/lineage.png)

然而国产手机，完全移除监控软件，并不是一件容易的事情，特别是在官方禁止解锁 Bootloader 后。下面的 GitHub 仓库列举了禁止解锁 Bootloader 的手机厂家黑名单。**不出意外，所有国产手机榜上有名**。

> 非常讽刺的是，Bootloader 加锁原本是防止安装监控软件，结果官方自己集成了监控软件，这下成了防止用户卸载官方的监控软件了。

- [GitHub: bootloader-unlock-wall-of-shame](https://github.com/melontini/bootloader-unlock-wall-of-shame)

为了重装自带监控软件的系统，这篇文章首先介绍安卓手机的主要结构，接下来分别介绍怎么解锁每个组件。

- 1. 解锁 Bootloader
- 2. 替换默认 Recovery 为 TWRP
- 3. 重新安装系统 (ROM)
- 4. Magisk 获取 Root 权限 

**除了移除监控软件，还有一个额外的收获**：之前小米发布 HyperOS 后，Google 碰巧更新了安全组件，以至于所有自定义的 ROM 都无法使用 Google Pay 了。除了耐心等待小米打补丁，发布新的 ROM 外，也可以通过文章后面提到的 Magisk 绕过安全检测，就可以正常使用 Google Pay 了（**当然，Google 表示反对这种操作**）。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/google_pay.png)



## 0 Android 系统结构

以 Android EMUI (国内俗称哄蒙) 为例，**自下而上，最底层是芯片 SoC**，例如 Kirin 960/95х/65x/620，我们首先给 SoC 安装 Bootloader (系统引导)，随后在 Bootloader 之上安装 Recovery (系统恢复)，用来安装 Android 系统，最后是顶层 Android APK 应用。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/android.png)



**自上而下，**如果我们希望重装 Android 系统，就需要从 Recovery 安装非官方系统 (ROM)，由于国内手机的 Recovery 禁止安装非官方系统，**我们需要先替换 Recovery**。

**为了替换 Recovery，我们又需要解锁 Bootloader**。由于解锁 Bootloader 后，开发者就对手机有了完整的控制权限，可以看到手机系统的全部结构，**这样不利于鸿蒙宣传自主研发，所以在鸿蒙 2.0 发布后，华为迅速禁止了 Bootloader 解锁功能。**

另一方面，为了完整卸载监控软件，我们可能需要手机 root 权限，如今最受欢迎、最简单的 root 方式 Magisk，也需要首先解锁 Bootloader。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/magisk.png)

那么问题来了，怎么才能解锁 Bootloader 呢？

> 重要警告：解锁 bootloader 会清空手机数据，记得备份，操作前务必先熟悉 adb 和 fastboot。



## 1 解锁 Bootloader

总体来讲，有三种办法。



### 1.1 官网解锁

首先，最简单的办法就是从官方途径解锁了，例如对开发者比较友好的小米，可以在官方网站申请解锁 Bootloader，不过需要等待一周，未来也有可能关闭官方申请途径。

前面也提到，由于不利于宣传鸿蒙自主研发，华为官方早就不支持 Bootloader 解锁了。

所以对于国产手机来讲，这条路大部分情况被堵死了。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/mi_bootloader.png)



### 1.2 Brute Force

另一种办法是暴力破解，毕竟 Unlock Code 只是一串 16 位的数字，如果运气足够好，花些时间遍历，也能不通过官方途径，找到 Unlock Code。

- [GitHub: Huawei Bootloader Bruteforce](https://github.com/rainxh11/HuaweiBootloader_Bruteforce)

```
fastboot oem unlock YOUR_CODE_HERE
```

当然，如果手机有 root 权限，也能从文件系统里直接读出 Unlock Code；**然而通过 Magisk 获取 root 权限，还是得先解锁 Bootloader**。 



### 1.3 硬件 SoC

最后一种解决办法是直接把 Bootloader 覆盖了。比如 SoC 出厂的时候，需要烧写 Bootloader 和 Unlock Code，我们可以用同样的办法覆盖 SoC 的 Bootloader。

不过并不是所有的 SoC 都有公开的免费工具，**这里以华为的 Kirin 系列为例**，可以把电路板上 TestPoint 接地后，利用 PotatoNV 工具覆盖 Bootloader。

- [GitHub: PotatoNV](https://github.com/mashed-potatoes/PotatoNV)

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/potatonv.png)

这种办法需要拆机，不同型号的手机 TestPoint 位置也不一样，有的型号只用拆后盖就可以暴漏 TestPoint 了，有的还需要额外拆除金属屏蔽盖，例如把下面图中红色圈出的 TestPoint 和 金属盖 (Ground) 短接，手机开机后 USB 连接电脑，会识别出来一个串口 COM，PhotoNV 软件连接上串口就可以覆盖 Bootloader 了。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/testpoint.png)

这类似于 MCU 覆盖出厂固件，一旦我们顺利 解锁/覆盖 Bootloader，剩下的操作就非常轻松了：**替换 Recovery，重装系统 ROM，安装 Magisk**。



## 2. 替换 Recovery

由于国产手机默认的 Recovery，只能安装官方认证的 ROM，我们在安装第三方 ROM 前，需要把默认的 Recovery 替换为 TWRP：

- [TWRP: Supported Devices](https://twrp.me/Devices/)

在上面的链接找到自己手机的型号后，下载 twrp.img，三行命令就可以安装 TWRP 了：

```
# 1. 手机打开开发者模式，ADB 调试
# 2. 电脑安装好 platform-tools 和 Android 驱动

$ adb reboot bootloader

$ fastboot flash recovery twrp.img
$ fastboot reboot
```

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/twrp.png)



## 3. 重装系统 ROM

在安装好 TWRP 后，手机重启按住开机键和音量下，就可以进入上图的 TWRP 界面了。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/rom.png)

我们可以提前把想要重装的 ROM 下载到手机里，在 TWRP 界面选择 Install，然后文件浏览选择提前下载好的 系统 [ROM.zip](http://rom.zip/) 文件，就会自动重新安装系统了，其实非常简单。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/flash.png)

例如小米各种型号的 ROM 可以在这个网站下载：

- [MIFirm: Xiaomi ROM 下载](https://mifirm.net/model/vangogh.ttt)



## 4. Magisk 应用 (Root)

最后一步其实是可选的，前面如果解锁了 Bootloader，替换了 Recovery，基本就可以自由地给手机安装各种操作系统了，而进一步安装 Magisk 一方面是获取 root 权限定制系统；另一方面可以绕开一些安全限制，例如最开始提到的，小米无法使用 Google Pay 的问题就可以解决。

### 4.1 安装 Magisk

现在 Magisk 有两个版本，不过它们的安装方式一模一样：先在手机上安装 Magisk.apk，接下来给 boot.img 打补丁，重启完成安装。

- 官方 Magisk：[GitHub - topjohnwu/Magisk: The Magic Mask for Android](https://github.com/topjohnwu/Magisk)
- 第三方 Magisk Delta：[GitHub - HuskyDG/magisk-files](https://github.com/HuskyDG/magisk-files)

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/magisk_delta.png)

- 1. 在 Github 上下载好 Magisk.apk，在手机上安装。
- 2. 从手机的 ROM.zip 里面提取出来 boot.img，复制到手机里。
- 3. 在手机 Magisk 里给 boot.img 打补丁，再用 fastboot 安装到手机里。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/magisk_install.png)



![img](https://doc.wuhanstudio.cc/posts/android_bootloader/magisk_patch.png)

我们需要记住上面保存的 magisk_patched-26401_xxxx.img 文件，然后用 adb 下载到电脑上，用 fastboot 烧写替换原来的 boot 分区，这样手机重启就可以获取 root 权限了。

```
$ adb pull sdcard/Download/magisk_patched-26400_REPLACE_RANDOM_STRING.img
$ adb reboot bootloader

$ fastboot devices
$ fastboot flash boot magisk_patched-26400_REPLACE_RANDOM_STRING.img
$ fastboot flash vbmeta --disable-verity --disable-verification vbmeta.img
```



### 4.2 Magisk 绕过安全检测

在获取 root 权限后，一些非常重视安全性的软件，会无法使用。例如，Google Pay，Barcalys，LLoyds 等海外银行软件，所以我们需要配置 Magisk 绕过这些安全检测。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/lloyds.png)

在 Magisk 的设置界面，我们需要打开 MagiskHide，这样就可以把 Magisk 应用隐藏，银行软件就检测不到它的存在了；另一方面，需要打开 Zygisk 安装一些插件。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/magisk_setting.png)

这些插件需要从 Github 上下载 zip 安装包，然后在手机 Magisk 的 Modules 界面从文件夹安装。

- [GitHub - K3V1991/Passing-SafetyNet-with-Magisk-Zygisk-and-DenyList](https://github.com/K3V1991/Passing-SafetyNet-with-Magisk-Zygisk-and-DenyList)
- [GitHub - Displax/safetynet-fix](https://github.com/Displax/safetynet-fix)
- [GitHub · LSPosed/Shamiko](https://github.com/LSPosed/LSPosed.github.io/releases)

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/magisk_module.png)

正常来讲，安装好插件后清空一下 Google Play 和 Google Service 的数据，**重启手机，**这些银行软件的安全检测就可以绕过了 (**对于 Barclays 和 LLoyds，需要禁止获取手机已安装的 App 权限**)。

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/google_play.png)



![img](https://doc.wuhanstudio.cc/posts/android_bootloader/google_play_security.png)

如果并没有绕开安全检测，我们可以下载下面2个软件，一步步排查错误：

- Play Integrity API Checker (前两项通过就可以了)
- YASNAC (全部通过)

![img](https://doc.wuhanstudio.cc/posts/android_bootloader/play_api.png)



![img](https://doc.wuhanstudio.cc/posts/android_bootloader/yasnac.png)



## 总结

只要顺利解锁了手机的 Bootloader (数据会被格式化)，其实更新 Recovery 和 ROM 都比较简单，而最后一步通过 Magisk 获取 root 权限，最困难的在于不被 Google，Barclays 等安全应用发现，这样我们的 Android 手机就告别了 Big Brother。