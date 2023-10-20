在 RTOS 上移植 MicroROS (ROS2)
============================

> 这篇文章会先介绍一下 ROS2 的架构，接下来以 Arduino 和 RT-Thread 为例，介绍如何移植 MicroROS 到嵌入式平台，这样就可以在 MCU 上使用 ROS2 的 API，例如发布 (publish)、订阅 (subscribe) 相关的话题 (topic)，调用服务 (service) 等等。

## Introduction

第一代 ROS 在各种型号的机器人上得到广泛应用之后，为什么要发布第二代 ROS 呢？在 ROS2 Design [1] 这篇文章里有详细介绍，这里我总结一下我比较感兴趣的几点：

- **多机器人协作**：第一代 ROS 设计主要针对的是单个机器人，这一点从 ROS1 只有一个 master 节点也可以看出来，而 ROS2 希望考虑到多个机器人之间的协同设计、通信，逐渐走向一个分布式的架构。
- **嵌入式平台**：最初的 ROS 只支持 Debian / Ubuntu，虽然有 rosserial 可以让单片机 (MCU) 和 ROS master 通信，但整体 ROS 是不考虑嵌入式平台的。毕竟 ROS 最早是 2007 年发布的，当时的 MCU 太慢了 (主频 16MHz - 72MHz)，那个年代才刚刚推出 ST32F1 (Cortex M3) 系列，而现在一些 MCU 主频都突破 1GHz 了，例如 i.MX RT Cortex-M7 系列。于是 ROS2 也开始针对中高端的嵌入式平台。
- **生产环境**：ROS 最早是由斯坦福的 2 个博士生设计的，当时设计 ROS 主要也是方便实验室科研，并没有考虑部署到实际的生产环境。

总体来看，就是从 2007 到 2022，这 15 年间时代发生了巨大的改变，从单个机器人设计到如今的机器人集群，MCU 从 72MHz 到突破 1GHz。另一方面，曾经的 ROS1 在十多年的应用中也暴露出了很多设计上的不合理，如果要继续修改 ROS1 满足当前时代的需求，会引入大量的修改，甚至导致与以前的 ROS 不兼容。最终 Open Source Robotics Foundation 决定设计全新的 ROS2，而以前的  ROS1 也会继续维护，只不过 ROS1 和 ROS2 现在是分开维护的，并不保证两者完全兼容。

## ROS2 Stack

在详细介绍 MicroROS 的移植过程之前，简单介绍一下全新的 ROS2 架构，因为 MicroROS 也用到了不少 ROS2 的抽象层源码。

ROS2 和 ROS1 最大的区别就是引入了 DDS (Data Distribution Service) [2]，前面提到 ROS1 需要在 master 节点启动之后，其他节点才能陆续加入，而其他节点和主节点的通信是依赖 XML-RPC，如果要在嵌入式设备上实现 XML-RPC 会引入相当多的软件包依赖，这也是 ROS1 无法直接支持嵌入式 MCU 的最大原因，所以像 rosserial 是自定义了一套更加轻量级的通信协议帮助 MCU 和 PC Ubuntu 上的 master 节点通信。ROS2 则引入了工业界非常成熟的 DDS 作为节点间的通信、发现 (discovery) 协议，DDS 已经在军工，航天，金融系统领域证明了它的稳定性 [3].

这里顺便一提，DDS 只是一个标准，不同公司有不同的代码实现，例如有 Cyclone DDS (Eclipse)，Fast DDS (eProsima)，Micro XRCE-DDS (eProsima) 等等，所以一套 ROS2 Stack 底层的 DDS 其实是可以替换的，为了保证替换不同厂家的 DDS，上层 ROS2 代码不需要改变，ROS2 也重新定义了一些抽象层，例如 RCL (ROS Client Library) 和 RMW (ROS Middleware)。

这样底层不同的 DDS 实现，都提供了相同的 RMW (ROS Middleware) 接口。在 RMW 之上，则定义了 RCL (ROS Client Library)，RCL 是由 C 实现的，这样也可以向上提供不同编程语言的支持，例如 C++，Python，Java。

这样看来，要想移植 ROS2，最重要的是 RTOS 需要支持一个具体的 DDS 实现，和对应的 RMW，这样上层的 RCL 和 ROS Application 的代码就是可以不需要任何修改的。

![img](https://doc.wuhanstudio.cc/posts/uros_rtt/ros2_stack.png)

最后顺便一提，**ROS2 提供了 C 的支持，而 ROS1 是只支持 C++ 的**。



## MicroROS

现在我们知道 ROS2 主要由 RCL，RMW，DDS 组成，如果要移植 ROS2 就需要实现一套 RMW + DDS 组合，上层的 RCL 不需要修改，而 MicroROS 则是提供了这样一套组合。

MicroROS 采用的是 DDS 是自己专门针对嵌入式设备实现的 [Micro XRCE DDS](https://github.com/eProsima/Micro-XRCE-DDS) (e**X**tremely **R**esource **C**onstrained **E**nvironment standard)，以及自己对接的 [RMW](https://github.com/micro-ROS/rmw_microxrcedds)。

这样看来，要**移植 MicroROS 其实就是需要对接 Arduino / RT-Thread 和不同平台的通信，例如 UART 和 UDP**。

![img](https://doc.wuhanstudio.cc/posts/uros_rtt/uros_stack.png)



## Arduino

这里 MicroROS 在 Arduino 上的移植已经有[官方维护](https://github.com/micro-ROS/micro_ros_arduino)了 [4]，后面我们也是参考 Arduino 的移植，实现对 RT-Thread 的支持。

MicroROS 的移植主要有 2 个部分：

1. 对接 UART / UDP 通信和时钟，也就是实现 default_transport.cpp 里面的 5 个函数。
2. 打包 DDS + RMW + RCL 生成 libmicroros.a 静态库。

```
int clock_gettime(clockid_t unused, struct timespec *tp) __attribute__ ((weak));

bool arduino_transport_open(struct uxrCustomTransport * transport) __attribute__ ((weak));
bool arduino_transport_close(struct uxrCustomTransport * transport) __attribute__ ((weak));

size_t arduino_transport_write(struct uxrCustomTransport * transport, uint8_t *buf, size_t len, uint8_t *errcode) __attribute__ ((weak));
size_t arduino_transport_read(struct uxrCustomTransport * transport, uint8_t *buf, size_t len, int timeout, uint8_t *errcode) __attribute__ ((weak));
```

如果大家熟悉 Arduino 的话，会发现第一步对接驱动，其实非常非常简单：

```
bool arduino_transport_open(struct uxrCustomTransport * transport)
{
  Serial.begin(115200);
  return true;
}

bool arduino_transport_close(struct uxrCustomTransport * transport)
{
  Serial.end();
  return true;
}

size_t arduino_transport_write(struct uxrCustomTransport * transport, uint8_t *buf, size_t len, uint8_t *errcode)
{
  (void)errcode;
  size_t sent = Serial.write(buf, len);
  return sent;
}

size_t arduino_transport_read(struct uxrCustomTransport * transport, uint8_t *buf, size_t len, int timeout, uint8_t *errcode)
{
  (void)errcode;
  Serial.setTimeout(timeout);
  return Serial.readBytes((char *)buf, len);
}
```

至于第二步打包 DDS + RMW + RCL 生成 libmicroros.a 静态库，需要针对不同的硬件修改编译选项，Arduino 已经支持的硬件可以使用 docker 完成，当然我们也需要区分不同的 ROS2 版本 (Foxy，Galactic，Humble)。

```
git clone https://github.com/micro-ROS/micro_ros_arduino && cd micro_ros_arduino
docker pull microros/micro_ros_static_library_builder:galactic
docker run -it --rm -v $(pwd):/project --env MICROROS_LIBRARY_FOLDER=extras microros/micro_ros_static_library_builder:galactic
```

这里需要注意的是，静态库生成过程会从 github clone 大量的仓库，可能需要 VPN 才能顺利拉下来全部的仓库，最终使用的仓库索引会保存在 **built_packages** 文件。我们可以看到，主要包含的源码仓库有 ROS2 的编译系统 ament ( 对应 ROS1 catkin)，前面提到的 MicroROS-XRCE-DDS-Client，RCL，RMW，以及 ROS2 定义的标准 micro_ros_msgs 和 msgs 的依赖 ROS IDL 和 libyaml。

```
https://github.com/ament/ament_cmake.git 65a3ad5f128e4b727187fa38c10af2fc6d4f9d53
https://github.com/ament/ament_index.git 496403d0865866041d7ce9a95172a6b0e186c812
https://github.com/ament/ament_lint.git 96d9ca4fd32b18a1e083b9e952930c93251be4f4
https://github.com/ament/ament_package.git 6098894352c478eb65de3fe70b46730cf30b8c5c
https://github.com/ament/googletest.git f544da397da024f876d0094461a0e167ad293f63
https://github.com/ament/uncrustify_vendor.git 0aa3bf65f5b2093aea09f83d89e86eeff129a019
https://github.com/eProsima/Micro-CDR.git cb4403a8780095df94a7b1936b1e00153c90070d
https://github.com/eProsima/Micro-XRCE-DDS-Client.git 88bb91044c0bc58ba39828973f5dfd2b13feb8d6
https://github.com/micro-ROS/micro_ros_msgs.git e3664463e78ae5d0c34d86be92d707b3d9dfd27d
https://github.com/micro-ROS/micro_ros_utilities 31e017dc06e2ab4c9f0822100638cd919dbb7872
https://github.com/micro-ROS/rcl 98bb690e17b147f194bd2c92786784814539702e
https://github.com/micro-ROS/rcutils 0c380197594b56142e157b8f565f3879c617f02e
https://github.com/micro-ROS/rmw-microxrcedds.git 7505d97111f30de8258dcba8c479603d5b6d97b0
https://github.com/micro-ROS/rosidl_typesupport.git d21bde140e1a4b413f6725888470b758a739171d
https://github.com/micro-ROS/rosidl_typesupport_microxrcedds.git 106fda6a43a912e09480d7b705f3ca4a31a1803c
https://github.com/ros-controls/control_msgs a555c37f1a3536bb452ea555c58fdd9344d87614
https://github.com/ros2/ament_cmake_ros.git 3dcf062187223efba18a10a30faff209da0bfc52
https://github.com/ros2/common_interfaces.git 8584562aa9de9ea042c3fbc87020f7352729a396
https://github.com/ros2/example_interfaces.git 489b7c12071ddbd1d0d0bb1a161387324f76f0d5
https://github.com/ros2/libyaml_vendor.git 5ae991d39c36583fc295c819ba3370aa0d7b3672
https://github.com/ros2/rcl.git 191b13bc2eb8578e40799eb6b50c74b885e7066e
https://github.com/ros2/rcl_interfaces.git 3d1255ce8f651df40ae2186406ac3cfe68dbca3c
https://github.com/ros2/rcl_logging.git 8b31efe346611d67a3f3fa3649a7b29f34f156b3
https://github.com/ros2/rclc 7a856162fda90ebbe405225cfe4ec1163d5c855a
https://github.com/ros2/rcpputils.git 8a94c1c189561bfd8115e1cbdd2c94f5706ef323
https://github.com/ros2/rmw.git 2259c3f6f3de8c479a9d5c74cdcd03d0010413cd
https://github.com/ros2/rmw_implementation.git 1809f1491b27cce9b0de49fa152ed233a2be21f4
https://github.com/ros2/rosidl.git 51811962c832745f531968d351af3d1af45cd238
https://github.com/ros2/rosidl_dds.git 1d2019eb1af73af444d698381128a3b5de50d8da
https://github.com/ros2/rosidl_defaults.git e6e56c2bae30d4694a0bf0d74937917283564b8c
https://github.com/ros2/test_interface_files.git e0db71e2916b244a8e218bd3fbc1a6d7c18f2b3e
https://github.com/ros2/unique_identifier_msgs.git ba3a672c6f5b071490a659f8a0b7019c6a32d7b8
https://github.com/yaml/libyaml.git 2c891fc7a770e8ba2fec34fc6b545c672beb37e6
https://gitlab.com/micro-ROS/ros_tracing/ros2_tracing.git/ 638fa0ab095ae1e941b05187418f0089c431e8d9
```

最后生成的 libmicroros.a 可以在下面的目录里找到：

```
~/micro_ros$ find ./ -name *.a

./src/cortex-m4/fpv4-sp-d16-softfp/libmicroros.a
./src/cortex-m0plus/libmicroros.a
./src/cortex-m3/libmicroros.a
./src/mk20dx256/libmicroros.a
./src/mk64fx512/fpv4-sp-d16-hard/libmicroros.a
./src/imxrt1062/fpv5-d16-hard/libmicroros.a
./src/cortex-m7/fpv5-d16-softfp/libmicroros.a
./src/cortex-m7/fpv5-sp-d16-softfp/libmicroros.a
```

可以看到，默认会生成所有支持平台的 libmicroros.a，我们可能只希望生成自己开发板的静态库，例如我们可以指定只生成 Cortex-M3 的静态库：

```
cd micro_ros_arduino
docker run -it --rm -v $(pwd):/project --env MICROROS_LIBRARY_FOLDER=extras microros/micro_ros_static_library_builder:galactic -p cortex_m3
```

如果很不幸，自己的开发板不在支持列表，我们也可以添加自己的平台。假如我们希望添加 Turtlebot 的 OpenCR 开发板，我们需要先添加一个 CMake 文件指定编译选项，例如 **opencr_toolchain.cmake**，在这里面指定硬件相关的编译选项，例如 FPU：

```
SET(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_CROSSCOMPILING 1)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)

set(CMAKE_C_COMPILER $ENV{TOOLCHAIN_PREFIX}gcc)
set(CMAKE_CXX_COMPILER $ENV{TOOLCHAIN_PREFIX}g++)

SET(CMAKE_C_COMPILER_WORKS 1 CACHE INTERNAL "")
SET(CMAKE_CXX_COMPILER_WORKS 1 CACHE INTERNAL "")

set(FLAGS "-O2 -mfloat-abi=softfp -mfpu=fpv5-sp-d16 -ffunction-sections -fdata-sections -nostdlib --param max-inline-insns-single=500 -fno-exceptions -mcpu=cortex-m7 -DF_CPU=216000000L -DARDUINO=10813 -mthumb -DSTM32F746xx" CACHE STRING "" FORCE)

set(CMAKE_C_FLAGS_INIT "-std=c11 ${FLAGS} -DCLOCK_MONOTONIC=0 -D'__attribute__(x)='" CACHE STRING "" FORCE)
set(CMAKE_CXX_FLAGS_INIT "-std=c++14 ${FLAGS} -fno-rtti -DCLOCK_MONOTONIC=0 -D'__attribute__(x)='" CACHE STRING "" FORCE)

set(__BIG_ENDIAN__ 0)
```

接下来在 **library_generation.sh** 文件里增加新建的编译选项：

```
if [ $OPTIND -eq 1 ]; then
    PLATFORMS+=("opencr1")
    PLATFORMS+=("teensy4")
    PLATFORMS+=("teensy32")
    PLATFORMS+=("teensy35")
    PLATFORMS+=("teensy36")
    PLATFORMS+=("cortex_m0")
    PLATFORMS+=("cortex_m3")
    PLATFORMS+=("cortex_m4")
    # PLATFORMS+=("portenta-m4")
    PLATFORMS+=("portenta-m7")
    PLATFORMS+=("kakutef7-m7")
    PLATFORMS+=("esp32")
fi
```

这样我们就可以针对自己新加的平台生成静态库了。

```
docker run -it --rm -v $(pwd):/project --env MICROROS_LIBRARY_FOLDER=extras microros/micro_ros_static_library_builder:galactic -p opencr1
```

到这里，我们对接好了 UART / UDP 通信和时钟，也生成了 libmicroros.a 静态库，就可以运行 MicroROS 了。

## RT-Thread

在 RT-Thread 上的移植也是类似的过程，需要先对接 RTT 的 UART / UDP 驱动和时钟，再生成对应平台的静态库。下面是对接 RT-Thread 串口的代码，RT-Thread 现在同时支持 UART 和 UDP 通信。

```
int clock_gettime(clockid_t unused, struct timespec *tp)
{
    (void)unused;

    uint64_t m = rt_tick_get() * 1000 / RT_TICK_PER_SECOND * 1000;
    tp->tv_sec = m / 1000000;
    tp->tv_nsec = (m % 1000000) * 1000;

    return 0;
}

static rt_err_t uart_input(rt_device_t dev, rt_size_t size)
{
    rt_sem_release(&rx_sem);

    return RT_EOK;
}

bool rtt_transport_open(struct uxrCustomTransport * transport)
{
    micro_ros_serial = rt_device_find(MICRO_ROS_SERIAL_NAME);
    if (!micro_ros_serial)
    {
        LOG_E("Failed to open device %s", MICRO_ROS_SERIAL_NAME);
        return 0;
    }
    if(sem_initialized == 0)
    {
        rt_sem_init(&rx_sem, "micro_ros_rx_sem", 0, RT_IPC_FLAG_FIFO);
        sem_initialized = 1;
    }
    rt_device_open(micro_ros_serial, RT_DEVICE_FLAG_INT_RX);
    rt_device_set_rx_indicate(micro_ros_serial, uart_input);
    return 1;
}

bool rtt_transport_close(struct uxrCustomTransport * transport)
{
    rt_device_close(micro_ros_serial);
    rt_sem_detach(&rx_sem);
    sem_initialized = 0;
    return 1;
}

size_t rtt_transport_write(struct uxrCustomTransport * transport, const uint8_t *buf, size_t len, uint8_t *errcode)
{
    return rt_device_write(micro_ros_serial, 0, buf, len);
}

size_t rtt_transport_read(struct uxrCustomTransport * transport, uint8_t *buf, size_t len, int timeout, uint8_t *errcode)
{
    int tick = rt_tick_get();
    for (int i = 0; i < len; ++i)
    {
        if(sem_initialized == 0)
        {
            rt_sem_init(&rx_sem, "micro_ros_rx_sem", 0, RT_IPC_FLAG_FIFO);
            sem_initialized = 1;
        }
        while (rt_device_read(micro_ros_serial, -1, &buf[i], 1) != 1)
        {
            rt_sem_take(&rx_sem, timeout / 4);
            if( (rt_tick_get() - tick) > timeout )
            {
                // LOG_E("Read timeout");
                return i;
            }
        }
    }
    return len;
}
```

当然，不论是 Arduino 还是 RT-Thread 的 [micro_ros](https://github.com/wuhanstudio/micro_ros) 软件包，都已经提供有一系列预生成的静态库，只有在自己的硬件没有预先支持，或者编译选项和自己希望的不一样的时候，才需要自己生成 libmicroros.a。

![img](https://doc.wuhanstudio.cc/posts/uros_rtt/uros_rtt.png)

添加图片注释，不超过 140 字（可选）

顺便一提，在 RT-Thread 上移植的时候，还会出现编译器版本不一样，造成 __ctype_ptr__ 未定义的错误，默认是使用 gcc 5.4.1 生成的静态库，和 RT-Thread Studio 使用的相同版本的编译器。

现在 RT-Thread 的软件包 micro_ros 也是以预生成的静态库 libmicroros.a 链接的形式发布的，未来当然是希望能完全以源码的形式发布，这样就不需要针对新的硬件重新生成静态库了。 

不幸的是，MicroROS 在 RT-Thread 上的移植大概是我一年前做的，最近一年 (2022) RT-Thread 的 libc 做了重大改变，而 MicroROS 也做了不少更新，因此最新版本的 RTT + MicroROS 还有很多问题需要修复；幸运的是，这个项目成为了[中科院开源之夏](https://summer-ospp.ac.cn/#/org/orgdetail/f338e884-b285-4c7c-b908-f931ba7dba82/)的项目之一，现在由杜海军同学在积极维护；另一方面同时进行的也有 Cyclone DDS 在 RT Smart 上的移植，希望不久之后能有一套完整的 ROS2 Stack 实现。

## 总结

这篇文章介绍了为什么要设计 ROS2，以及 ROS2 的架构 (RCL + RMW + DDS)，最后以 Arduino 和 RT-Thread 为例介绍如何移植 MicroROS 和 libmicroros.a 静态库的生成，希望未来 ROS2 能早日在 RTOS 嵌入式平台上有原生的全面支持。 

## References

- [1] [Why ROS 2?](https://design.ros2.org/articles/why_ros2.html)
- [2] [Changes between ROS 1 and ROS 2](https://design.ros2.org/articles/changes.html)
- [3] [Robot Operating System 2: Design, architecture, and uses in the wild](https://www.science.org/doi/10.1126/scirobotics.abm6074)
- [4] [GitHub - micro-ROS/micro_ros_arduino: micro-ROS library for Arduino](https://github.com/micro-ROS/micro_ros_arduino)