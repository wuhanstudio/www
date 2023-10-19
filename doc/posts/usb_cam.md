如何 伪造/篡改 USB 摄像头
===========

## 0. Introduction

> 为什么要做这样魔幻的事情呢？因为我在想，**深度学习到底能不能安全地部署**？会不会有人能很轻易地攻击部署好的深度学习模型？

![](https://wuhanstudio.nyc3.cdn.digitaloceanspaces.com/doc/usb_cam/usb_cam_demo.gif)


> 除了科普性的介绍，这篇文章后面也会介绍如何用 Buildroot 构建 bootloader，定制 Linux 内核，根文件系统，如何用 C 读取 /dev/video0 的数据，并且把 YUYV422 格式转换成 OpenCV 的 YV12，RGB，最终 JPEG 编码实时推送 MJPEG 视频流。项目源码放在了 github 上，可以在最后的参考文献找到链接。

30 年前 (1989) 深度学习还只能费力地部署在台式机上，最终却也只能做个手写体识别；

![img](https://doc.wuhanstudio.cc/posts/usb_cam/mnist.gif)

大约 15 年前 NVIDIA 发布了 **cudnn** (2007) 从此开启了在 **GPU** 上训练模型的时代；

![img](https://doc.wuhanstudio.cc/posts/usb_cam/cudnn.jpg)

随后 Intel 也发布了 **AVX-256** 指令集 (2008) ，帮助加速深度学习在 **CPU** 上的训练、部署；

![img](https://doc.wuhanstudio.cc/posts/usb_cam/avx512.jpg)

大概 10 年前 Xilinx 发布了 **ZYNQ** 多核异构 ARM + FPGA 系列 (2011)，帮助深度学习走向**低功耗**；

![img](https://doc.wuhanstudio.cc/posts/usb_cam/zynq.jpg)

到了 2015 年，**Tensorflow** (Google) 和 **Pytorch** (Facebook) 陆续发布，从此深度学习的门槛极大地降低，各行各业都开始学习深度学习。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/tf_torch.jpg)

4 年前 ST 发布了 **STM32 Cube AI** (2018)，随后 Google 又发布了 **Tensorflow Lite** (2019)，大家又开始热衷于在内存、存储、算力都很有限的 **MCU** 上部署深度学习；

![img](https://doc.wuhanstudio.cc/posts/usb_cam/tf_lite.jpg)

到了 2021 年，国内又掀起了一股**无人驾驶**造车的浪潮，突然深度学习开始大面积地部署。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/driving.jpg)

那么问题来了，深度学习是不是真的已经安全稳定到，可以部署在无人驾驶这样非常注重安全，几乎不允许出错的领域呢？以目标检测系统为例，我是不是可以在不被发现的情况下恶意篡改模型的输出，让它检测出本不存在的物体，或者让它没法检测现实存在的物体 (e.g. 路人，红绿灯) ?

当然，这个问题并不是没有人考虑过，从 2015 年第一个针对图像分类模型的攻击开始 (FGSM)，接下来的 6-7 年，陆续有1万多篇 paper 尝试去改变输入的图像，在不被人察觉到原始图像被篡改的情况下，恶意修改模型的输出。

比如下面的经典非法案例，下面左边的大熊猫，加上了中间肉眼看不出来的干扰，右边还是一只大熊猫，然而深度学习会把它识别为长臂猿。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/fgsm.png)

但是过了这么多年，如今深度学习大量被部署的时代，我们有几千上万种攻击深度学习的方式，却几乎没有看到现实生活中，因为被人恶意攻击而造成模型失效的例子，这是为什么呢？

- 大部分攻击方式需要获取被攻击模型的**训练集**，而现实应用中，在连拿到别人的模型都很困难的情况下，更别谈要获取别人的数据集了；
- 很多攻击没法实现**实时性**，攻击前需要在 GPU 上经过一段很长时间的优化，然而现实世界模型大都是实时运行的，等到在 GPU 上跑出来攻击结果，早已物是人非；
- 一些勉强能实现接近实时的攻击方式依赖于**梯度 (Gradients)**，而只有在模型训练的时候会计算梯度，部署运行 (Inference) 的时候不会计算梯度；
- 即使，假设我们很幸运能拿到别人的数据集，又很巧妙的实现了实时的攻击，甚至还不需要梯度，又会发现真的有这个必要吗？

如果我们能直接干扰实际系统的输入图像，通常意味着我们已经获得别人操作系统的访问权限，既然已经可以访问别人的系统了，何必费劲心力去增加干扰，直接 **sudo halt** (关机) 不是就解决问题了吗？

很多 paper 中的攻击方式，通常是自己的电脑上有一个模型，然后想办法自己攻击自己，但是在面临残酷的现实的时候，很多条件都没法实际实现。**于是我在思考一个问题，如果我们没有别人的数据集，没有办法访问别人的系统，没法根据梯度实时更新攻击，是不是还能实时地攻击深度学习模型，并且不被人发现呢？**

最终我得到了下面的这个结论：

![img](https://doc.wuhanstudio.cc/posts/usb_cam/adv_cam.jpg)

**我们其实是可以把攻击放到传感器端的，终于说到了文章标题，例如直接伪造、篡改摄像头数据。虽然深度学习训练集、模型、操作系统都是几乎无法访问的，但是传感器通常是直接暴露在外的，因为需要采集外界信息。**

如同密码学领域经典的中间人攻击 (Man-in-the-Middle Attack)，我们能不能在摄像头和系统的中间连接处施加干扰？答案是可以的，比如下面 Windows 识别到了一个普普通通的摄像头，但是其实这个摄像头本身就是一个已经被恶意攻击的摄像头。我们不需要拿到操作系统的访问权限，就可以攻击深度学习模型，因为我们的攻击是针对传感器 (摄像头) 的。

![](https://wuhanstudio.nyc3.cdn.digitaloceanspaces.com/doc/usb_cam/usb_cam_demo.gif)

科普性质的介绍就到此结束了，面临严苛的现实，却还希望能实时攻击实际系统，接下来就是需要经历曲折的 Engineering。

**大概思路是这样的**：我们需要一块 Linux 开发板，一端 USB Host 连接摄像头，拿到原始摄像头的数据，另一端 USB OTG 模拟一个摄像头，把篡改后的数据再转发出去。这样从 PC 上看，它只检测到有一个 USB 摄像头连接上来了，却没法分辨图像输入是不是收到了篡改。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/struct.png)

添加图片注释，不超过 140 字（可选）

## 1. 读取 Linux 摄像头数据 (V4L2)

首先，我们需要读取原始摄像头的数据。常见的摄像头数据包格式有2种 (MJPEG 和 YUYV 422)，我们可以用 v4l2-ctl 命令看看自己的摄像头支持哪些格式：

```
$ v4l2-ctl --list-formats -d /dev/video0
ioctl: VIDIOC_ENUM_FMT
	Type: Video Capture

	[0]: 'MJPG' (Motion-JPEG, compressed)
	[1]: 'YUYV' (YUYV 4:2:2)
```

**现在的 USB 摄像头一般是 2 种都支持的，其中 YUYV 422 是没有经过压缩的数据**，所以视频的质量通常都不是特别高 (360p)，毕竟要传输实时、高清、未压缩的视频流，可能超过了 USB 的最大传输速率 (USB2.0 High Speed 480Mbps)；**MJPEG 从名字也可以看出来，自然就是经过 JPEG 压缩后的图像**，压缩后数据量大大减少，所以可以用来传输高清视频流 (720p, 1080p)。

### 1.1 YUYV422 图像格式

这里简单解释一下 YUV 颜色空间，通常我们熟悉的是 RGB (红绿蓝)，那么为什么摄像头用的是 YUV 呢？因为人的眼睛对亮度变化 (Y) 比较敏感，但是对色度变化 (U, V) 却不是那么敏感 ，所以为了节省视频传输空间，从 YUYV 422 命名也可以看出来，我们对亮度 (Y4) 进行了 2 倍的采样，而色度 (U2 V2) 采样虽然少一些，人眼是看不出来区别的。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/yuv422.jpg)

下面就是 YUYV 422 的格式，可以看到 Y 出现了 4 次 (Y0, Y1, Y2, Y3)，U 出现了 2 次 (U0, U1)，V 出现了 2 次 (V0, V1)，这也就是命名里面 422 的由来。不过下面其实是 4 个像素点的数据，所以 4 个像素点一共花费了 (4 +2+2) = 8 byte 的数据，平均每个像素点就花费了 8 / 4 = 2 byte 数据，相比 RGB 一个像素点需要3个字节 (RGB 各一个)，YUYV 只需要 2 个字节，节省了 1 /3 空间。知道了 USB 摄像头的像素格式，接下来就是读取摄像头的图片数据了。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/yuyv.png)

在 linux 系统，视频设备都是以 /dev/video 的形似挂载的，我们需要用 V4L2 (**Video for Linux** version 2) 驱动读取里面的图像，这里我主要参考下面的链接，并在其基础上支持了 YUYV422，RGB888，MJPEG 格式：

### 1.2 V4L2 读取图像

大致分为3个部分：打开摄像头，配置摄像头，内存映射，读取图像数据。

首先，我们可以打开摄像头，获取一个文件描述符 (file descriptor)，因为 Linux 设备都是以文件的形式挂载的，所以这和打开一个文件几乎是一样的。

```
fd = open(v4l2_devname, O_RDWR);
if (fd == -1)
{
    perror("Opening video device");
    return 1;
}
```

接下来我们需要配置摄像头的像素格式，分辨率，像素的格式我们需要用到的是 YUYV 和 MJPEG。当然，如果使用 OpenCV 写出 RGB888 的格式到 v4l2loopback 虚拟设备，也是可以读取的。

```
struct v4l2_format fmt = {0};
fmt.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
fmt.fmt.pix.width = 1280;
fmt.fmt.pix.height = 720;

fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_YUYV;
// fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_MJPEG;
// fmt.fmt.pix.pixelformat = V4L2_PIX_FMT_RGB24;

fmt.fmt.pix.field = V4L2_FIELD_NONE;
    
if (-1 == xioctl(fd, VIDIOC_S_FMT, &fmt))
{
    perror("Setting Pixel Format");
    return 1;
}
```

配置好摄像头格式之后，我们需要做内存映射，把摄像头的图像内存映射到指针，这样我们后面就可以读取数据了，比如下面把摄像头的内存映射到一个 uint8_t* 的 buffer 里面：

```
uint8_t *buffer;

struct v4l2_requestbuffers req = {0};
req.count = 1;
req.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
req.memory = V4L2_MEMORY_MMAP;
 
if (-1 == xioctl(fd, VIDIOC_REQBUFS, &req))
{
    perror("Requesting Buffer");
    return 1;
}
 
struct v4l2_buffer buf = {0};
buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
buf.memory = V4L2_MEMORY_MMAP;
buf.index = 0;
if(-1 == xioctl(fd, VIDIOC_QUERYBUF, &buf))
{
    perror("Querying Buffer");
    return 1;
}
 
buffer = mmap (NULL, buf.length, PROT_READ | PROT_WRITE, MAP_SHARED, fd, buf.m.offset);
```

最后，我们就可以读取摄像头的数据了：

```
struct v4l2_buffer buf = {0};
buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
buf.memory = V4L2_MEMORY_MMAP;
buf.index = 0;

if(-1 == xioctl(fd, VIDIOC_QBUF, &buf))
{
    perror("Query Buffer");
    return 1;
}
 
if(-1 == xioctl(fd, VIDIOC_STREAMON, &buf.type))
{
    perror("Start Capture");
    return 1;
}
 
fd_set fds;
FD_ZERO(&fds);
FD_SET(fd, &fds);
struct timeval tv = {0};
tv.tv_sec = 2;

int r = select(fd+1, &fds, NULL, NULL, &tv);
if(-1 == r)
{
    perror("Waiting for Frame");
    return 1;
}
 
if(-1 == xioctl(fd, VIDIOC_DQBUF, &buf))
{
    perror("Retrieving Frame");
    return 1;
}
```

但是读出来的数据在 uint8_t* buffer 的指针里，我们还需要把它转换为 OpenCV 的矩阵，方便之后做图像处理：

```
cv::Mat cv_img;

if (format == 0 ){
    // Decode YUYV
    cv::Mat img = cv::Mat(cv::Size(image_width, image_height), CV_8UC2, buffer);
    cv::cvtColor(img, cv_img, cv::COLOR_YUV2RGB_YVYU);
}

if (format == 1) {
    // Decode MJPEG
    cv::_InputArray pic_arr(buffer, image_width * image_height * 3);
    cv_img = cv::imdecode(pic_arr, cv::IMREAD_UNCHANGED);
}

if (format == 2) {
    // Decode RGB3
    cv_img = cv::Mat(cv::Size(image_width, image_height), CV_8UC3, buffer);
}

cv::imshow("view", cv_img);
```

这样我们就顺利读取到 /dev/video 的数据，并且转换成 OpenCV 的格式了，剩下的就是把图像编码转发到虚拟摄像头了。完整代码可以在 Github 上找到：

## 2. USB Gadget 虚拟摄像头

我们需要一个支持 USB Gadget 模拟摄像头设备的 Linux 内核。如果是树莓派4的话，内核默认是支持的，其他的开发版可能就需要重新编译 Linux 内核了。

### 2.1 Buildroot 构建 Linux 内核、根文件系统

Buildroot 可以帮我们快速构建引导 (u-boot)，Linix 内核，和根文件系统。如果是使用 buildroot 编译内核的话，需要打开  UVC V4L2 摄像头支持：

```
$ make linux-menuconfig

--> Device Drivers
  Multimedia Support -->
    Media USB Adapters -->
      [M] USB Video Class
      V4L platform devices -->
```

其次，我们需要打开 USB Gadget Configfs，这样就可以配置 USB 模拟摄像头了 （g_webcam 已经被淘汰了，不建议使用）：

```
-> Device Drivers
  -> USB support (USB_SUPPORT [=y])
    -> USB Gadget Support (USB_GADGET [=m])
      -> USB Gadget functions configurable through configfs (USB_CONFIGFS [=m])
```

这样我们就可以在 linux 启动后加载内核模块了：

```
# modprobe libcomposite dwc2

# mount | grep configfs
configfs on /sys/kernel/config type configfs (rw,relatime) 
```

当然，如果是想完全伪造一个不存在的设备，也可以使用 v4l2loopback，不过这个是在 buildroot 的根文件系统里选择：

```
$ make menuconfig

-> Target packages
    -> Audio and video applications
        -> v4l2loopback (BR2_PACKAGE_V4L2LOOPBACK [=y])
```

配置编译好 Linux 内核之后，接下来就可以启动 linux 进行后续的配置了。当然，不要忘了在 Linux 设备树里打开USB OTG：

```
/*
 *usb_port_type: usb mode. 0-device, 1-host, 2-otg.
 *usb_detect_type: usb hotplug detect mode. 0-none, 1-vbus/id detect, 2-id/dpdm detect.
 *usb_detect_mode: 0-thread scan, 1-id gpio interrupt.
 *usb_id_gpio: gpio for id detect.
 *usb_det_vbus_gpio: gpio for id detect. gpio or "axp_ctrl";
 *usb_wakeup_suspend：0-SUPER_STANDBY, 1-USB_STANDBY.
 */


&usbc0 {
        device_type = "usbc0";
        usb_port_type = <0x2>;
        usb_detect_type = <0x1>;
        usb_detect_mode = <0>;
        usb_id_gpio = <&pio PB 8 GPIO_ACTIVE_HIGH>; /*unused */
        enable-active-high;
        usb_det_vbus_gpio = <&pio PB 9 GPIO_ACTIVE_HIGH>;/*unused */
        usb_wakeup_suspend = <0>;
        usb_serial_unique = <0>;
        usb_serial_number = "20080411";
        rndis_wceis = <1>;
        status = "okay";
};
```

### **2.2 Configfs 配置虚拟摄像头**

Configfs 可以让我们在用户态 (userspace) 配置 linux 内核驱动，比如我们可以配置 USB OTG 成串口，访问 linux 控制台；或者配制成以太网口，利用 USB OTG 共享网络，当然，接下来要做的是配置成 USB 摄像头，这部分只要照着文档配置就可以了。

比如我们可以任意改变 USB 的厂家，设备名：

```
echo 0x1d6b > /sys/kernel/config/usb_gadget/pi4/idVendor
echo 0x0104 > /sys/kernel/config/usb_gadget/pi4/idProduct
echo 0x0100 > /sys/kernel/config/usb_gadget/pi4/bcdDevice
echo 0x0200 > /sys/kernel/config/usb_gadget/pi4/bcdUSB

echo 0xEF > /sys/kernel/config/usb_gadget/pi4/bDeviceClass
echo 0x02 > /sys/kernel/config/usb_gadget/pi4/bDeviceSubClass
echo 0x01 > /sys/kernel/config/usb_gadget/pi4/bDeviceProtocol

mkdir /sys/kernel/config/usb_gadget/pi4/strings/0x409
echo 100000000d2386db > /sys/kernel/config/usb_gadget/pi4/strings/0x409/serialnumber
echo "Samsung" > /sys/kernel/config/usb_gadget/pi4/strings/0x409/manufacturer
echo "Fake Camera" > /sys/kernel/config/usb_gadget/pi4/strings/0x409/product
mkdir /sys/kernel/config/usb_gadget/pi4/configs/c.2
mkdir /sys/kernel/config/usb_gadget/pi4/configs/c.2/strings/0x409
echo 500 > /sys/kernel/config/usb_gadget/pi4/configs/c.2/MaxPower
echo "UVC" > /sys/kernel/config/usb_gadget/pi4/configs/c.2/strings/0x409/configuration

mkdir /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0
mkdir -p /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/control/header/h
ln -s /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/control/header/h /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/control/class/fs
```

当然，也可以设置虚拟摄像头的数据格式，这里主要有2个，也就是前面提到的：未压缩的 (uncompressed) 和压缩的（MJPEG）：

```
# MJPEG 720p

mkdir -p /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p
cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p/dwFrameInterval
5000000
EOF
cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p/wWidth
1280
EOF
cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p/wHeight
720
EOF
cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p/dwMinBitRate
29491200
EOF
cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p/dwMaxBitRate
29491200
EOF
cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/mjpeg/m/720p/dwMaxVideoFrameBufferSize
1843200
EOF
```

未压缩的 YUYV（低分辨率）：

```
# YUYV 360p

# mkdir -p /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p
# cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p/dwFrameInterval
# 666666
# 1000000
# 5000000
# EOF
# cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p/wWidth
# 1280
# EOF
# cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p/wHeight
# 720
# EOF
# cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p/dwMinBitRate
# 29491200
# EOF
# cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p/dwMaxBitRate
# 29491200
# EOF
# cat <<EOF > /sys/kernel/config/usb_gadget/pi4/functions/uvc.usb0/streaming/uncompressed/u/360p/dwMaxVideoFrameBufferSize
# 1843200
# EOF
```

完整的配置可以在这里找到：

## 3. YUV 转码 MJPEG 推流

现在，我们可以读取 /dev/video0 的图像数据，也定制了一个 Linux 内核可以模拟 USB 摄像头，最后一步当然就是修改视频流了，为了实现实时的性能，这里需要手动转码。这里有2条路径：

![img](https://doc.wuhanstudio.cc/posts/usb_cam/yuv_jpg.jpg)

不做图像处理直接编码转发视频流 YUYV --- YUV3 --- JPEG

![img](https://doc.wuhanstudio.cc/posts/usb_cam/yuv_rgb_jpg.jpg)

OpenCV 图像处理后编码转发视频流 YUYV --- RGB888 --- YV12 --- YUV3 --- JPEG

有些我们可以用 OpenCV 和 libJPEG 转换，但图上虚线部分是需要我们手写转换格式的，因为 libJPEG 的输入要求是 YUV3 的格式，而 OpenCV 输出是 YV12，所以需要实现 **YUYV --> YUV3** 和 **YV12 --> YUV3**。

### 3.1 YUYV to YUV3

前面提到，YUYV 422 是因为人眼对色度不那么敏感，所以为了节省带宽，UV 只用了一半的存储空间；而 YUV3 其实数据内容是一模一样的，只是为了方便处理，把 YUV 做成了等长，大致看起来格式是这样的：

```
// YUV422 (2 pixels)
| Y0 U0 Y1 V0 | Y2 U1 Y3 V1 |

// YUV 3  (2 pixels)
| Y0 U0 V0 | Y1 U0 V0 | Y2 U1 V1 | Y3 U1 V1 |
```

可以看到，YUV3 其实就是为了让  YUV 等长，而把 UV 重复了一遍，所以当我们转换图片的一行可以这么操作：

```
for (i = 0, j = 0; i < cinfo.image_width * 2; i += 4, j += 6) { 
    //input strides by 4 bytes, output strides by 6 (2 pixels)
    tmprowbuf[j + 0] = input[offset + i + 0]; // Y (unique to this pixel)
    tmprowbuf[j + 1] = input[offset + i + 1]; // U (shared between pixels)
    tmprowbuf[j + 2] = input[offset + i + 3]; // V (shared between pixels)
    tmprowbuf[j + 3] = input[offset + i + 2]; // Y (unique to this pixel)
    tmprowbuf[j + 4] = input[offset + i + 1]; // U (shared between pixels)
    tmprowbuf[j + 5] = input[offset + i + 3]; // V (shared between pixels)
}
```

也就是浪费一些存储空间，把 Y1 U1 Y2 V1 重新排序成 Y1 U1 V1 | Y2 U2 V2 的格式。

### 3.2 YV12 to YUV3

这两个格式之间的转换就略微有些麻烦了，前面 YUYV 到 YUV3 的转换其实只是做了个冗余的重新排序，因为它俩一张图片的内存排布方式是一样的，都是按顺序存储 YUV，然而 YV12 就略微复杂，它是先存储所有的 Y，然后再存储所有的 U，最后再存储所有的 V，在内存里的排布看起来是这样的：

![img](https://doc.wuhanstudio.cc/posts/usb_cam/yuv3.jpg)

这有点类似于图片在 CPU 和 GPU 的 Channel 排布不同，从 NWHC 转换到 NCWH。

```
for (i = 0, j = 0; i < cinfo.image_width; i += 1, j += 3) { 
    //input strides by 3 bytes, output strides by 1 (2 pixels)
    tmprowbuf[j + 0] = input[i + cinfo.image_width * cinfo.next_scanline];
    // Jump through all Y (cinfo.image_width * cinfo.image_height)
    tmprowbuf[j + 1] = input[i / 2 + cinfo.image_width * cinfo.image_height + (cinfo.image_width / 2) * (cinfo.next_scanline / 2)];
    // Jump through all Y and U ((cinfo.image_width / 2) * (cinfo.image_height / 2))
    tmprowbuf[j + 2] = input[i / 2 + cinfo.image_width * cinfo.image_height + (cinfo.image_width / 2) * (cinfo.image_height / 2) + (cinfo.image_width / 2) * (cinfo.next_scanline / 2)];
}
```

上面宽高分别除以了2是因为前面提到，人眼对色度 (UV) 不敏感，所以一个 2x2 的 4 个像素点，其实用的同一个 1 个 U 来存储，所以 UV 在内存宽高的占用，各是 Y 的 1/2。

### **3.3 JPEG 编码**

当然，如果是简单的图片叠加，其实我们也可以不解码，直接做图像处理，但是这对原始图片的尺寸有一些要求，后期优化性能可以考虑直接对 JPEG 做图像处理。这里简单介绍一下 JPEG 编码，使用 libjpeg 编码。

其实 JPEG 的编码还是比较简单的，对原始图片首先进行 离散余弦变换 (Discrete Cosine Transform)，然后进行量化，损失一部分信息，但是图像尺寸得到减少，最后进行霍夫曼编码。而解码就是完全相反的过程，先霍夫曼解码，去除量化，最后做个 DCT  反变换就得到原始图像了。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/jpg_encoding.jpg)

为什么要进行 DCT 变换呢？这也是为了方便后面进行量化，一张图片其实可以表示为下面的 64 种分量组合：

![img](https://doc.wuhanstudio.cc/posts/usb_cam/dct.png)

![img](https://doc.wuhanstudio.cc/posts/usb_cam/dct_img.png)

当然，一张图片里并不会同时包含所有的分量，例如纯色背景图左上角的低频分量就会比较多，而右下角的高频分量就会比较少，所以我们在后一步量化的时候，可以量化掉掉图片里的一部分信息，但是图片整体看起来不会有明显的区别。

最后的霍夫曼编码，其实是为了压缩存储空间，前面经过量化之后，一张图片的 RGB 值可能性大大减少，比如一张 8x8 纯黑的背景，所有的值都是0，那么我们其实并不需要存储 64 个 0，只要存储 64，0，后面只要按照规则知道这代表 64 个 0 进行解码就可以了。

下面这张图就是霍夫曼编码的直观表示，例如一个字节 a, b, c, d 占的存储空间都是 1 个字节，8 bit，但是一个文件内并不一定会出现 ASCII 码表里所有的字符，经过霍夫曼编码之后，a 可以只用1个 bit 0 表示，b 用 111 一共 3 个 bit 表示，就节省了大量的存储空间。

![img](https://doc.wuhanstudio.cc/posts/usb_cam/hoffman.jpg)

## 4. 总结

于是到此为止，介绍了 USB 摄像头的 2 种常见格式 (YUYV 和 MJPEG)，前者 YUYV 是未压缩的低分辨率图像，后者 MJPEG 可以实时传输高分辨率的压缩后图像，并说明了如何从 V4L2 文件 /dev/video0 里面读取数据，并进行转码 (YUYV --> YUV3) (YV12 --> YUV3)，利用 OpenCV 进行图像处理，随后 JPEG 编码 (DCT 变换 --> 量化 --> Huffman 编码)，最后利用定制的 Linux 内核，初始化 USB OTG 为摄像头设备，实时传递篡改后的视频流数据到 PC 端。 

![img](https://doc.wuhanstudio.cc/posts/usb_cam/adv_cam.jpg)

## 5. References

[1] https://github.com/wuhanstudio/capturev4l2

[2] https://github.com/wuhanstudio/adversarial-camera