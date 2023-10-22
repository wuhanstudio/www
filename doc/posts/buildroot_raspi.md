Buildroot 定制嵌入式 Linux (树莓派 4)
===============================

> Buildroot 定制 Linux 内核固件，添加自己的软件包，以及自动初始化程序

## 0. 为什么需要 树莓派 4

作为各种 Linux Pi 开发板 （Nano Pi，香蕉派，香橙派，芒果派，荔枝派）的始祖，树莓派一直以来都是以简单好用、性能强大，以及**供电不足**而闻名。

即使是完全不了解 Linux 的人，也可以把 树莓派4 当作一个便携式电脑使用。然而，树莓派的芯片是 Broadcom 定制的，只能用作生产树莓派，所以不像 Arduino 那样出现了各种山寨版，树莓派非常成功地保留了正版，只是催生了各种其他水果派：水果的名字如今都快被用完了。

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/intro.png)

最近需要 树莓派4 是因为之前一个科研项目，用 [**树莓派4 攻击目标识别**](https://github.com/wuhanstudio/adversarial-camera)，需要读取 V4L2 的视频流，用 OpenCV 解码、篡改、编码、转发，再利用 USB Gadget 模拟一个虚拟摄像头。这些代码是用 C/C++ 访问的底层硬件，在 Linux 内核的 DWC3 驱动做了一些改动后，原来的程序无法使用了，而相关的 Linux 驱动还在更新中，所以决定先固定 Linux Kernel v5.10。

这个项目没有用其他开发板，是因为模拟摄像头需要用到 Linux 的内核驱动 UVC Gadget，虽然 Allwinner 的 Linux 开发板性价比很高，但是 Allwinner 的 H2，H3，H5+ 芯片内部的 USB IP 似乎是精简的，不支持 UVC Gadget。之后又陆续尝试了 RockPi，Zynq，[i.MX](http://i.mx/) 6，树莓派 0/3/4，只有 树莓派 0/4 和 [I.MX](http://i.mx/) 6 的 UVC Gadget 是可以使用的。考虑到实时攻击的性能，也为了方便其他人重复实验，最终选择了树莓派 4。

## 0. 为什么需要 Buildroot

虽然树莓派官方的 Raspberry Pi OS (Raspbian) 很好地支持了定制芯片，但树莓派芯片的一些非常规操作，**例如上电先由 GPU 初始化系统**，由 GPU 从 ROM 读取系统引导，再把所有权交给 CPU，给硬件开源移植带来了一些麻烦。

另一方面，我需要固定 Linux Kernel v5.10，不幸的是，树莓派官方的 Raspi OS 内核、固件更新还算挺快的，最新的 Raspi OS 已经紧随 Linux Kernel v6.1 的步伐了，定期适配不同驱动版本还是挺头疼的，于是打算定制一个可以自己控制的轻量级嵌入式 Linux。 

当然，除了官方的 Raspbian，我们也可以用嵌入式 Linux 非常好用的 [**Armbian**](https://www.armbian.com/)，但是他俩系统镜像都需要几个GB，如果我们需要更加轻量级的 Linux 系统，还得依赖 **Buildroot / Yocto**。

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/buildroot.png)



一个完整的嵌入式 Linux 需要包括 **Bootloader (引导)，Kernel (内核) 和 rootfs (根文件系统)**，如果自己从头编译所有部件再组合，还是挺麻烦的。Buildroot 可以用一行命令 make 自动完成编译，并打包成一个 sdcard.img，非常方便。

接下来会介绍，如何用 Buildroot 定制一个轻量级的 Linux，选择自己需要的 Linux Kernel 版本，并且修改根文件系统 (rootfs)，集成自己的软件到 Buildroot 软件包，并且开机自动启动。

## 1. 安装 Buildroot

首先，Buildroot 本身已经支持 树莓派4 了，我们需要做的是在这个基础上定制。

```
$ git clone https://git.buildroot.net/buildroot
```

一般来讲，不建议使用 latest 源码，而是用一个 release 版本，所以我们切换到 2023.02 分支:

```
$ cd buildroot
$ git checkout 2023.02
```

在 buildroot 的 configs 目录里，我们可以看到所有已经支持的开发板，这里我们使用 树莓派4 的默认配置：

```
$ make raspberrypi4_64_defconfig
```

接下来就可以一行命令编译，通常会花费 30-60 分钟：

```
$ make
```

这样我们就可以看到在 output/images/ 目录下有一个 sdcard.img 可以烧录到 SD 卡启动。

```
sudo dd if=output/images/sdcard.img of=/dev/sdb
```

到这里为止，我们就用 Buildroot 给 树莓派4 构建了一个完整的嵌入式 Linux (≈150MB)，接下来介绍如何开始自己的定制。

## 2. 修改 Linux 内核

Buildroot 提供经典的 menuconfig 图形界面：

```
$ make menuconfig
```

在 Kernel 选项里，我们可以指定 Linux Kernel 的版本。

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/linux_kernel.png)

比如，我们可以指定 Linux 某个 Git Commit 的 hash，这样 Buildroot 就会下载编译对应的内核源码。

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/kernel_hash.png)

如果需要进一步配置 Linux 内核，例如添加对 USB Gadget 的支持，我们可以使用 linux-menuconfig 命令：

```
$ make linux-menuconfig
```

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/menuconfig.png)

这样，我们就可以详细配置 Linux 内核。

到这里为止，其实都算比较轻松，因为我们并没有修改任何 Buildroot 的源码，只是利用别人现成的工具，修改配置而已。接下来会介绍，如何在不需要大量改动 Buildroot 源码的情况下，更加优雅地集成自己的软件包。

## 3. 修改默认软件包版本

我的项目需要 OpenCV 4.5.3 和 rpi-firmware 软件包的特定版本，但是 Buildroot 并不可以选择软件包的版本，我们需要修改 buildroot/package 目录下对应软件包的配置源码，来切换软件包版本，好在这也并不复杂。

例如 OpenCV4 目录下有3个文件：

```
package/opencv4/
├── Config.in       # menuconfig 图形界面配置，类似 KConfig
├── opencv4.hash    # 保存软件包源码 tar.gz 的 hash，用于下载校验
└── opencv4.mk      # 定义软件包版本，一些编译选项和宏定义
```

好在 OpenCV4 相近版本的编译系统差距并不大，我们可以直接修改 [opencv4.mk](http://opencv4.mk/) 里的软件包版本：

```
OPENCV4_VERSION = 4.5.3
OPENCV4_SITE = $(call github,opencv,opencv,$(OPENCV4_VERSION))
OPENCV4_INSTALL_STAGING = YES
```

这样 Buildroot 就会自动从 github 上面拉取对应版本的源码包进行编译。当然，我们也需要添加对应版本源码的 hash 到 opencv4.hash 文件里，用于文件校验:

```
# Locally calculated
sha256  77f616ae4bea416674d8c373984b20c8bd55e7db887fd38c6df73463a0647bab  opencv4-4.5.3.tar.gz
sha256  cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30  LICENSE
```

上面的 sha256 其实可以自己下载对应的源码，然后在自己本地电脑上计算出来：

```
$ sha256sum ~/Downloads/opencv-4.5.3.tar.gz
```

同样，我们也可以修改 rpi-firmware 的软件包版本，不过区别是，除了可以用 tag 的版本号，我们也可以直接指定对应 commit 的 hash：

```
RPI_FIRMWARE_VERSION = e2bab29767e51c683a312df20014e3277275b8a6
RPI_FIRMWARE_SITE = $(call github,raspberrypi,firmware,$(RPI_FIRMWARE_VERSION))
RPI_FIRMWARE_LICENSE = BSD-3-Clause
```

这样 Buildroot 编译出来的系统就会带有指定版本的软件包。

虽然我们这一步修改了 Buildroot 的源码，但是修改其实并不多，所以我选择用 patch 的形式保存修改，以后下载 Buildroot 源码后，apply 对应的 patch 就可以了。

```
$ git diff > ../buildroot_rpi_firmware_opencv4.patch
$ git apply ../buildroot_rpi_firmware_opencv4.patch
```

Buildroot 修改内核配置，和修改已有软件包的版本，需要做的修改并不多，我们只需要保存 menuconfig 配置文件，和一个小 patch 就可以了。

但是，接下来需要修改 rootfs 和添加新的软件包，就需要做比较大的改动。我们并不希望因为这些改动就在 Github 仓库里保存整个 Buildroot 的源码，一个比较优雅的做法就是在单独的目录里维护自己项目的配置，称之为 Buildroot External Tree。

## 4. 定制开发板 External Tree

在 Buildroot 的官方文档里也有介绍，如何自定义自己的 Buildroot 项目，只要对 Linux 构成比较熟悉，实际操作起来也并不复杂。

### 4.1 文件结构

我们可以在 Buildroot 文件夹外面，建立一个单独的文件夹，用 Git 管理自己项目相关的配置，而不需要保存整个 Buildroot 源码，这是我们需要建立的文件结构：

```
/my_br2_tree/
  +-- board/
  |   +-- <company>/
  |       +-- <boardname>/
  |
  +-- configs/
  |   +-- <boardname>_defconfig
  |
  +-- Config.in
  +-- external.mk
  +-- external.desc
```

- board: 修改根文件系统的配置 (overlay)，例如添加一些开机启动的 service
- configs: 保存修改了 Linux Kernel 的配置文件为 [raspi4_minm_attack_defconfig](https://github.com/wuhanstudio/adversarial-camera/blob/master/hardware/buildroot-external-raspi4/configs/raspi4_minm_attack_defconfig)

```
# 创建项目文件夹
$ mkdir buildroot-external-raspi4
$ cd buildroot-external-raspi4

$ mkdir configs         # 项目配置列表
$ touch Config.in       # menuconfig 配置选项
$ touch external.mk     # 项目编译选项
$ touch external.desc   # 项目介绍
```

在 external.desc 里面保存项目相关的介绍，其中 name 是区分大小写的，一般都用大写。：

```
name: RASPI4_MINM_ATTACK
desc: A buildroot external tree for the Man-in-the-Middle Attack.
```

添加软件包需要用到 [external.mk](http://external.mk/) 和 [Config.in](http://config.in/)，我们可以先使用空白文件，后面需要添加自己的软件包了再配置。

### 4.2 默认配置 defconfig

这样，我们就可以保存自己前面 menuconfig 手动配置的文件到刚刚创建的 configs 目录。

```
mcake savedefconfig BR2_DEFCONFIG=../buildroot-external-raspi4/configs/raspi4_minm_attack_defconfig
```

以后就不需要每次都手动配置 Linux Kernel 版本之类的，可以直接使用保存的默认配置：

```
# 调用默认配置
make BR2_EXTERNAL=../buildroot-external-raspi4/ raspi4_minm_attack_defconfig

# 编译系统
make BR2_EXTERNAL=../buildroot-external-raspi4/ 
```

其实这样我们就已经有了一个最小的 Buildroot External Tree，尽管它只保存了我们的配置文件。

### 4.3 修改根文件系统配置

通常我们不光需要保存配置文件，还需要对跟文件系统做一些修改，比如添加一些系统初始化的配置。

我们可以把 board/company/overlay/ 目录当作 Linux 根文件系统，在这里做的修改都会被覆盖到编译生成的 rootfs 里。比如下面我们创建了 /etc/systemd/system/piwebcam.service 文件，这样编译输出的根文件系统里，也会有对应的 piwebcam.service 文件，用于配置开机自启动的 service。

当然，我们使用 /etc/systemd/system/ 配置 service 是因为我们在 menuconfig 的 System Configuration / Init system 里面选择了 systemd 初始化系统，如果是使用 busybox 则是修改 etc/init.d 目录。

```
board/
└── wuhanstudio/
        └── raspi4b/
            └── overlay/
                 └── etc/
                      ├── piwebcam/
                      │   ├── init.sh
                      │   ├── noise.npy
                      │   └── usb-gadget.sh
                      └── systemd/
                              └── system/
                                      └── piwebcam.service
```

 到这里为止，我们不光保存了自己的 defconfig，还修改了根文件系统，最后需要做的就是添加新的软件包了。

## 5. 添加新软件包

前面我们把 [Config.in](http://config.in/) 和 [external.mk](http://external.mk/) 文件留空了，接下来就会以添加 uvc-gadget 软件包为例添加配置。

首先，我们为新创建的软件包添加目录：

```
$ mkdir package/uvc-gadget/src/
$ touch package/uvc-gadget/Config.in
$ package/uvc-gadget/uvc-gadget.mk
```

在 buildroot-external-raspi4/Config.in 文件里，我们可以引用软件包的 Config.in，这样就可以在 meuconfig 界面看到我们的软件包了：

```
source "$BR2_EXTERNAL_RASPI4_MINM_ATTACK_PATH/package/uvc-gadget/Config.in"
```

当然，我们还需要在 package/uvc-gadget/Config.in 文件里定义软件包的配置和依赖：

```
config BR2_PACKAGE_UVC_GADGET
    bool "uvc-gadget"
    select BR2_PACKAGE_JPEG
    select BR2_PACKAGE_OPENCV4
    select BR2_PACKAGE_OPENCV4_LIB_HIGHGUI
    help
        Adversarial Camera package.

        https://github.com/wuhanstudio/adversarial-camera
```

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/new_package.png)

![img](https://doc.wuhanstudio.cc/posts/buildroot_raspi/uvc-gadget.png)

接下来在 [external.mk](http://external.mk/) 里面定义项目编译的一些配置，这样就会遍历所有 package 的 *.mk 配置。

```
include $(sort $(wildcard $(BR2_EXTERNAL_RASPI4_MINM_ATTACK_PATH)/package/*/*.mk))
```

值得注意的是，上面的变量 $(BR2_EXTERNAL_**RASPI4_MINM_ATTACK**_PATH) 指向我们的项目根目录 这是 buildroot 自动给我们设置的变量名，因为我们在 external.desc 文件里指定了 name。

最后就是在 package/uvc-gadget/external.mk 里指定自己软件包的编译选项了，主要也是定义软件包版本、依赖和软件源码的位置，下面我们选择了 local 是因为源码保存在本地文件夹，我们也可以设置成从 Github 上拉取源码：

```
################################################################################
#
# uvc-gadget package
#
################################################################################

UVC_GADGET_VERSION = 1.0
UVC_GADGET_SITE = $(BR2_EXTERNAL_RASPI4_MINM_ATTACK_PATH)/package/uvc-gadget/src
UVC_GADGET_SITE_METHOD = local
UVC_GADGET_DEPENDENCIES = opencv4 jpeg

define UVC_GADGET_BUILD_CMDS
    $(MAKE) CC="$(TARGET_CC)" CXX="$(TARGET_CXX)" LD="$(TARGET_LD)" -C $(@D)
endef

define UVC_GADGET_INSTALL_TARGET_CMDS
    $(INSTALL) -D -m 0755 $(@D)/uvc-gadget  $(TARGET_DIR)/usr/bin
endef

$(eval $(generic-package))
```

上面的配置里，Buildroot 会通过变量 $(CC) 和 $(CXX) 交叉编译的工具链。，如果自己的项目用到了 g++，千万不要忘了配置  CXX="$(TARGET_CXX)"。

当然，软件包编译系统的配置，例如 Makefile 和 CMake 是不由 Buildroot 管理的，例如我软件包的 Makefile 没有任何 Buildroot 相关的配置。

```
CXXFLAGS		:= -fpermissive -Wno-write-strings -Ofast
LDFLAGS			:= -g

all: uvc-gadget

%.o: %.cpp
	$(CXX) -c $(CXXFLAGS) -o $@ $< -I $(STAGING_DIR)/usr/include/opencv4

uvc-gadget: uvc-gadget.o
	$(CXX) $(LDFLAGS) -o $@ $^ -lopencv_videoio -lopencv_imgcodecs -lopencv_highgui -lopencv_imgproc -lopencv_core -ljpeg

clean:
	rm -f *.o
	rm -f uvc-gadget
```

这样我们在 menuconfig 里面选中自己的软件包， make 编译之后就会自动将我们的软件包安装到 Linux 文件系统：

```
# 修改配置
make BR2_EXTERNAL=../buildroot-external-raspi4/ menuconfig

# 编译系统
make BR2_EXTERNAL=../buildroot-external-raspi4/ 
```

最终的系统镜像依旧是输出到 output/images/sdcard.img 里。

## 总结

这篇文章介绍了，如何下载使用 Buildroot，修改默认软件包版本，修改 Linux Kernel 版本和配置，以及自定义 Buildroot External Tree，和添加自己的软件包到 Buildroot。

- A Man-in-the-Middle Attack against Object Detection: https://github.com/wuhanstudio/adversarial-camera