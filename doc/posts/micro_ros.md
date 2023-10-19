MicroROS on RT-Thread
=====================

- [MicroROS on RT-Thread](#microros-on-rt-thread)
- [前言](#--)
  * [ROS 简介](#ros---)
  * [RT-Thread 与 ROS](#rt-thread---ros)
  * [rosserial 和 micro_ros 的区别](#rosserial---micro-ros----)
- [RT-Thread 控制 Kobuki 机器人](#rt-thread----kobuki----)
  * [RT-Thread 使用 ESP8266 联网](#rt-thread----esp8266---)
  * [ROS1 (rosserial)](#ros1--rosserial-)
  * [ROS2 (micro_ros)](#ros2--micro-ros-)
- [总结](#--)
- [References](#references)

<img src="https://doc.wuhanstudio.cc/posts/micro_ros/rtt_uros.png">

# 前言

## ROS 简介

最初 2007 年左右，斯坦福机器人实验室的两个博士生，Eric Berger 和 Keenan Wyrobek 发现身边的同学们对机器人开发有一种望而却步的感觉。因为机器人本身是一个跨专业的学科，做软件的同学们不太了解机械结构，不熟悉机器人的设计装配流程；做算法的同学们又不太了解嵌入式，不太清楚底层传感器驱动的工作原理，于是合作起来会碰到很多障碍。为了解决这个问题，他们设计了最初的 Robot Operating System (ROS)，极大地提高了团队合作效率。

由于 ROS 简单好用上手快，从 2007 年 ROS 发布第一版并举行第一届全球 ROS Conf，到 2012 年底第五届会议，使用 ROS 的实验室已经遍布全球了。2013 年 ROS 就由 Open Source Robotics Foundation (OSRF) 接手维护了。另一方面，2005 年斯坦福拿下 DARPA 无人驾驶挑战赛冠军一举成名，随后 ROS 也诞生在斯坦福，很快在无人驾驶领域 ROS 也得到了广泛应用，并且 2018 DARPA 无人驾驶挑战赛专门设置了 ROS 赛道，参赛队伍需要在 ROS Gazebo 模拟环境下测试自己的无人车并得到评分。

<img src="https://doc.wuhanstudio.cc/posts/micro_ros/Stanley2.jfif" width=100%>

虽然 Robot Operating System (ROS) 取名为机器人操作系统，但其实它并不是一个操作系统，而是在 Linux 之上开发的一系列软件包。为了说明 ROS 开发的简单，高效和稳定，这里简单介绍一下 ROS 很重要的4个设计：


- Message (消息)：有的时候可能会苦恼传感器的信息应该以什么样的数据结构发送出去，于是 ROS 定义好了各种常见传感器的数据格式，有了模板只需要填充内容就可以了，这样节省了自定义数据结构的时间。另一方面，也可以自己写一个 .msg 文件定义新的数据结构，ROS 就可以自动生成对应的头文件。这和 Google 的 protobuf 非常相似，定义数据结构，就可以自动生成源码。总而言之，**ROS 的一个消息 (message) 也就是想要发送出去的一个数据包**。

- Topic (话题)：定义好了数据结构，如何把数据稳定的发送出去，稳定接收也是个问题。一对一的发送可能比较简单，但是如果多个算法需要同一个传感器输入，同一个算法又需要不同传感器输入，很快数据同步就变得棘手了。于是 ROS 采用了发布 (publish) - 订阅 (subscribe) 的模式，比如用 ROS 预先定义好的数据结构发送图像数据，发布出去的图像信息就可以在 /camera 这个话题下找到，所有订阅了这个话题的节点都会收到消息。**相当于我们把消息发给报社，所有订了报纸的人就会收到消息，这样我们只管发消息就是了**，剩下的 ROS 会保证所有节点都收到同步的消息。

![](https://doc.wuhanstudio.cc/posts/micro_ros/MultiplePublisherandMultipleSubscriber.gif)

- Node (节点)：像前面说的那样，消息发布出去后，ROS会保证所有订阅了这个话题的节点都会收到同步的消息。于是**一个节点的作用通常就是收一些消息，做一些处理，可能再发布一些新的消息**。比如人脸检测的节点，可能会订阅图像相关的话题，识别完再告诉其他节点自己识别的结果。通常，**一个节点只完成一件事情**，例如人脸识别的节点就只做人脸识别，不会同时又做摔倒检测。这样一个节点只处理一个比较小的任务，再合作实现更大的目标。顺便一提，**一个节点不等于一台电脑**，因为一台电脑如果性能比较强，完全可以部署好几个节点，这样也充分利用资源。

- Service (服务)：一方面节点可以通过订阅消息获得需要的信息，另一方面节点之间也可以通讯。例如目标追踪的节点，可能先需要调用目标检测节点的服务，知道目标在哪再去追踪。所以服务就是字面上的意思，每个节点可以提供一些服务供其他节点调用。

![](https://doc.wuhanstudio.cc/posts/micro_ros/service.png)

于是有了 ROS 之后，做嵌入式的同学只需要把传感器信息 (message) 发布出去，做算法的同学订阅自己需要的话题 (topic)，作为算法输入，再发布对应的输出。这样每个同学只用专心维护自己的节点，确保自己节点的输入输出正确，整个系统就能正常运作了。

----------------

除了软件设计，前面提到的 ROS Gazebo 仿真环境也极大地加快了迭代过程，在真正的机械臂加工装配之前，先在模拟环境确保可以实现预期的运动，也避免了不必要的试错过程。

![](https://doc.wuhanstudio.cc/posts/micro_ros/gazebo.gif)

当然，Gazebo 也可以和实际的机器人连接进行联合调试 [1]：

![](https://doc.wuhanstudio.cc/posts/micro_ros/gazebo_co.gif)


-------------------------

## RT-Thread 与 ROS

那么问题来了，前面提到 ROS 是在 Linux 上运行的一套软件框架，Linux 本身并不是实时系统，机器人一些对实时性要求比较高的任务并不太适合用 Linux，而 RT-Thread 虽然是实时操作系统（RTOS），但毕竟 MCU 的资源有限，并不能直接运行完整的 ROS。

于是，通常的做法是利用 Linux 丰富的软件包实现一些顶层算法，而 RT-Thread 则负责实时控制相关的任务，它们之间的通信就是后面会介绍到的 rosserial 和 micro_ros。

![image alt](https://atadiat.com/wp-content/uploads/2018/11/ROS-motor-controller.jpg)

## rosserial 和 micro_ros 的区别

它们共同的目标都是为了把 MCU 接入 ROS，使得 MCU 能和 ROS 通信，并且在 MCU 上调用 ROS 的 API，**主要区别就在于 rosserial 是针对 ROS1，而 micro_ros 是针对 ROS2** [2]。

第一代的 ROS 发展很多年后，当然也暴露出很多设计不合理的地方，比如有多个 ROS 主机的时候，需要设置 ROS_MASTER_URI 和 ROS_HOST_NAME 环境变量，帮助 ROS Master 找到不同的主机的 IP。一旦主机变多，IP 地址又不太固定的时候就会变得很麻烦，如果能让 ROS 自动发现主机就会方便很多。为了解决第一代 ROS 的历史遗留问题，并且添加新功能，OSRF 发现这会造成新的 ROS 破坏性地不兼容以前的版本，于是他们干脆就直接宣布进入第二代 ROS，重新再开发一套新的 ROS，这也就是 ROS2。

新一代的 ROS2 使用 Data Distribution Service (DDS) 通信，可以自动发现主机，这样分布式的系统设计就更加方便了，但是 DDS 并不算是一个轻量级的框架，如果要让 MCU 接入 DDS 必然需要足够的硬件资源。然而 ROS2 主要针对的是 64 位的中高端平台，MCU 并不是 ROS2 的主要支持对象，以至于第一代的 rosserial 到了第二代也基本放弃维护了。尽管如此，还是有不少开发者希望能让 MCU 接入 ROS2，直接在 MCU 上调用 ROS2 的 API，于是最终还是有了 Micro ROS。虽然 Micro ROS 借助 Micro XRCE-DDS 实现了轻量级的 DDS，但是**至少还是需要一个 32 位的中端 MCU**，不像第一代的 rosserial 那样可以运行在 8 位的低端 MCU 上。


# RT-Thread 控制 Kobuki 机器人

前面介绍了 ROS1/ROS2，也介绍了 rosserial (ROS1) 和 micro_ros (ROS2) 的区别，现在 RT-Thread 已经有了 rosserial 和 micro_ros 软件包分别能和 ROS1/ROS2 通信，同时也有 Kobuki 机器人底盘软件包 [5] 和激光雷达 rplidar 软件包 [6]，应当是可以跳过树莓派，直接用 RT-Thread 做一个 SLAM 机器人。顺便一提，**rosserial 支持串口和 TCP 通信，micro_ros 则支持串口和 UDP 通信**；rosserial 只支持 C++，而 micro_ros 支持 C/C++。

<img src="https://doc.wuhanstudio.cc/posts/kobuki.jpg" width=50%>

下面就以 RT-Thread 配合 ROS 控制 Kobuki 机器人为例，分别介绍如何在 RT-Thread 上和 ROS1 (rosserial)，ROS2 (micro_ros) 通信，并且下面的例子都是以无线 (Wifi) 为例，这样就可以不需要树莓派，运行 RT-Thread 的 MCU 直接接入 ROS 了。**顺便一提，下面的操作只要确保有3个串口，用什么开发板都可以。**，当然，如果不需要 RTT 控制台就只需要2个了。

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_ros.jpg)


## RT-Thread 使用 ESP8266 联网

无论是 rosserial (ROS1)，还是 micro_ros (ROS2)，联网部分都是一样的，这里就以 ESP8266 的 AT 固件联网为例。当然，用以太网也是可以的。

在开始 RT-Thread 开发之前，需要确保用来联网的 ESP8266 是使用的 AT 固件，固件可以在这里下载 (ai-thinker_esp8266_at_firmware_dout_v1.5.4.1-a_20171130.rar)：

https://docs.ai-thinker.com/en/%E5%9B%BA%E4%BB%B6%E6%B1%87%E6%80%BB

把 ESP8266 的串口连接到电脑以后，拉低 GPIO0 复位进入固件下载模式，这样 ESP8266 就可以处理 AT 指令了：

```
$ esptool.exe --port com5 erase_flash
$ esptool.exe --port com5 write_flash --flash_mode dout 0 Ai-Thinker_ESP8266_DOUT_8Mbit_v1.5.4.1-a_20171130.bin
```

把 ESP8266 和自己的开发板串口 (UART2) 连接上之后，根据自己的开发板型号，在 RT-Thread Studio 里新建项目。前面提到我们需要3个串口，所以在 driver/board.h 里需要打开三个串口，一个用作控制台，一个连接 ESP8266，最后一个和 Kobuki 机器人通信：

```
# MSH Console
#define BSP_USING_UART1
#define BSP_UART1_TX_PIN       "PA9"
#define BSP_UART1_RX_PIN       "PA10"

# ESP8266
#define BSP_USING_UART2
#define BSP_UART2_TX_PIN       "PA2"
#define BSP_UART2_RX_PIN       "PA3"

# Kobuki Robot
#define BSP_USING_UART3
#define BSP_UART3_TX_PIN       "PB10"
#define BSP_UART3_RX_PIN       "PB11"
```

接下来在 RT-Thread Studio 里面添加 AT_Device 软件包：

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_at.jpg)

并且双击软件包修改配置选项，选择自己的 wifi 模块，配置 WIFI SSID 和密码，选择 UART2 作为通信接口：

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_at_conf.jpg)

保存配置编译，如果一切正常的话，RT-Thread 上电后会自动连接 WIFI，并且可以 ping 通外部主机：

```
 \ | /
- RT -     Thread Operating System
 / | \     4.0.2 build Jun 14 2021
 2006 - 2019 Copyright by rt-thread team
[I/sal.skt] Socket Abstraction Layer initialize success.
[I/at.clnt] AT client(V1.3.0) on device uart2 initialize success.
msh >[I/at.dev.esp] esp0 device wifi is connected.
[I/at.dev.esp] esp0 device network initialize successfully.
[E/at.clnt] execute command (AT+CIPDNS_CUR?) failed!
[W/at.dev.esp] please check and update esp0 device firmware to support the "AT+CIPDNS_CUR?" cmd.
[E/at.clnt] execute command (AT+CIPDNS_CUR?) failed!
[W/at.dev.esp] please check and update esp0 device firmware to support the "AT+CIPDNS_CUR?" cmd.
[E/at.skt] AT socket (0) receive timeout (2000)!

msh >ping rt-thread.org
32 bytes from 118.31.15.152 icmp_seq=0 time=242 ms
32 bytes from 118.31.15.152 icmp_seq=1 time=245 ms
32 bytes from 118.31.15.152 icmp_seq=2 time=241 ms
32 bytes from 118.31.15.152 icmp_seq=3 time=245 ms

msh >
```

当然，这一部分联网的操作也可以参照 RT-Thread 官网的文档：

https://www.rt-thread.org/document/site/#/rt-thread-version/rt-thread-standard/application-note/components/at/an0014-at-client

最后我们把 Kobuki 机器人的串口和 RT-Thread 开发板的串口 (UART3) 接上，在 RTT Studio 软件包里添加 Kobuki：

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_kobuki.jpg)

并双击软件包配置 Kobuki 通信接口为 uart3 就可以准备对接 ROS 了。

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_kobuki_conf.jpg)

## ROS1 (rosserial)

第一代 ROS 支持 串口 和 TCP 通信，这里以 TCP 为例，在 RT-Thread Studio 先添加软件包：

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_rosserial.jpg)

双击软件包后配置使用 TCP 连接并且添加 Kobuki 机器人的例程：

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_rosserial_conf.jpg)

完整的代码在 Github 上面都有，所以这里主要解释 rosserial 的核心初始化代码。在 MCU 上的初始化和在 PC 上初始化几乎是一模一样的，就是首先 `setConnection()` 定义 ROS Master 的 IP 地址和端口，接下来 `initNode()` 初始化节点，最后订阅 `/cmd_vel` 用来接收电脑传过来的控制信息，并且设置 Kobuki 的速度。


```
static ros::Subscriber<geometry_msgs::Twist> sub("cmd_vel", messageCb );

static void rosserial_kobuki_thread_entry(void *parameter)
{
    // Please make sure you have network connection first
    // Set ip address and port
    nh.getHardware()->setConnection("192.168.199.100", 11411);

    nh.initNode();
    nh.subscribe(sub);
    while (1)
    {
        nh.spinOnce();
        rt_thread_mdelay(500);
    }
}
```

一旦收到 PC 传来的控制信息，在回调函数里更新线性运动的速度，和旋转角速度：

```
static void messageCb( const geometry_msgs::Twist& twist_msg)
{
    linear_x  = twist_msg.linear.x;
    angular_z = twist_msg.angular.z;
}
```

当然，Kobuki 线程里会不停地发送控制命令，因为**Kobuki 底盘的特点是，一旦一段时间没有收到命令，机器人就会停止运动**，所以我们需要不停地发送控制命令。

```
static void kobuki_entry(void *parameter)
{
    kobuki_init(&robot);
    while(1)
    {
        rt_thread_mdelay(100);
        kobuki_set_speed(linear_x, angular_z);
    }
    kobuki_close(&robot);
}
```

当然，既然我们是远程控制，当然不可能用串口连到 RTT 控制台输入命令启动机器人，所以需要在 main.cpp 里面自动启动任务。

```
#include <rtthread.h>
#include <ros.h>

int main(void)
{
    extern int rosserial_kobuki_control(int argc, char **argv);
    rt_thread_mdelay(10000);
    rosserial_kobuki_control(0, 0);
}
```

需要注意的是，这里主函数是 **main.cpp**，因为**rosserial 只支持 C++**。掐指一算，rosserial 相关的代码还不到 10 行，所以这也体现了 ROS 简单好用的特点。最后还有一点，**之前 rosserial 有一个 1Hz 的 bug，导致系统响应非常缓慢，这里要感谢 zhengyangliu 的 PR， 现在已经修复了**，整体 rosserial 使用 串口 和 TCP 都非常稳定（然而，ESP8266 本身不是很稳定）。

RT-Thread 相关的代码就结束了，当然我们还需要启动 ROS 主节点，这里我就用 docker 镜像了，把需要的端口映射出来：

```
$ docker run -p 11411:11411 -it helloysd/rosserial:noetic /bin/bash
```

在 **docker 容器的 bash** 里面安装相关软件包并启动 ROS Serial：

```
$ apt update
$ apt install curl
$ curl -s https://raw.githubusercontent.com/ros/rosdistro/master/ros.asc | sudo apt-key add -
$ apt update
$ apt install ros-noetic-teleop-twist-keyboard ros-noetic-rosserial-python
$ rosrun rosserial_python serial_node.py tcp
```

如果一切顺利的话会看到 RTT 节点连接上来：

```
root@29bd821af356:/# rosrun rosserial_python serial_node.py tcp
[INFO] [1624089042.689792]: ROS Serial Python Node
[INFO] [1624089042.693095]: Fork_server is: False
[INFO] [1624089042.693884]: Waiting for socket connections on port 11411
[INFO] [1624089042.694750]: Waiting for socket connection
[INFO] [1624089055.564072]: Established a socket connection from 172.17.0.1 on port 55784
[INFO] [1624089055.565926]: calling startSerialClient
[INFO] [1624089057.674819]: Requesting topics...
[INFO] [1624089229.750517]: Note: subscribe buffer size is 512 bytes
[INFO] [1624089229.751418]: Setup subscriber on cmd_vel [geometry_msgs/Twist]
```

终于可以使用 ROS 的 teleop 软件包用键盘远程控制 Kobuki 机器人了：

```
$ rosrun teleop_twist_keyboard teleop_twist_keyboard.py
```

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_kobuki.gif)

## ROS2 (micro_ros)

前面提到，第二代 ROS 主机之间的通信是建立在 DDS/RTPS 之上的，不过这些不需要自己实现，可以直接在 RT-Thread Studio 里面添加 micro_ros 软件包：

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_microros.jpg)

几乎同样的流程，双击软件包之后选择通信方式为 UDP，根据自己的开发板选择不同的架构，因为 micro_ros 相关的库是预先编译好为 libmicroros.a 的，并且现在支持的有 Cortex M0，Cortex M3，Cortex M4，Cortex M7，如果是其他架构的话，就需要在 extras/library_generation 下添加相关的编译文件，重新编译对应架构的库文件。另一方面，默认编译库文件用的是 gcc 5.4.1，和 RTT Studio 的编译器版本一致也是嵌入式最常用的版本，如果是更新版本的 gcc 或者 Keil 等其他编译器，也需要重新生成 libmicroros.a。

当然，选择了 Kobuki 的例程之后，我们也需要指定 Kobuki 的串口 UART3。

![](https://doc.wuhanstudio.cc/posts/micro_ros/rtt_microros_conf.jpg)

同样的，例程默认是把相关的任务导出为命令，我们在机器人上电后不可能每次都连上串口在 RTT 控制台下面启动任务，所以需要在 main.c 里面自动启动相关的任务：

```
#include <rtthread.h>

int main(void)
{
    extern int microros_kobuki_control(int argc, char **argv);
    rt_thread_mdelay(10000);
    microros_kobuki_control(0, (void*)0);
}
```

这里介绍一下 micro_ros 的启动流程，先设置 micro_ros client 的 IP 地址，UPD 端口号，在启动注册相关的节点，最后订阅自己需要的话题 (topic)，启动 executor 设置相关的回调函数就可以了。

```
set_microros_udp_transports("192.168.199.100", 9999);

allocator = rcl_get_default_allocator();

// create init_options
if (rclc_support_init(&support, 0, NULL, &allocator) != RCL_RET_OK)
{
    rt_kprintf("[micro_ros] failed to initialize\n");
    return;
};

// create node
if (rclc_node_init_default(&node, "micro_ros_rtt_sub_twist", "", &support) != RCL_RET_OK)
{
    rt_kprintf("[micro_ros] failed to create node\n");
    return;
}

// create subscriber
rclc_subscription_init_default(
  &subscriber,
  &node,
  ROSIDL_GET_MSG_TYPE_SUPPORT(geometry_msgs, msg, Twist),
  "cmd_vel");

// create executor
rclc_executor_init(&executor, &support.context, 1, &allocator);
rclc_executor_add_subscription(&executor, &subscriber, &msg, &kobuki_callback, ON_NEW_DATA);
```

每当收到新的消息时候，就会在回调函数里更新机器人的控制信息。

```
//twist message cb
static void kobuki_callback(const void *msgin) {
    const geometry_msgs__msg__Twist * msg = (const geometry_msgs__msg__Twist *)msgin;
    linear_x = msg->linear.x;
    angular_z = msg->angular.z;
}
```

同样的，Kobuki 机器人需要不停地发送控制命令，一旦一段时间没有收到控制命令，Kobuki 就会自动停下来，这也是一种保护机制。

```
static void kobuki_entry(void *parameter)
{
    kobuki_init(&robot);
    while(1)
    {
        rt_thread_mdelay(100);
        kobuki_set_speed(linear_x, angular_z);
    }
    kobuki_close(&robot);
}

static void microros_kobuki_entry(void *parameter)
{
    while(1)
    {
        rt_thread_mdelay(100);
        rclc_executor_spin_some(&executor, RCL_MS_TO_NS(100));
    }
}
```

RT-Thread 开发完成之后，最后当然还是需要在电脑上启动 micro_ros client，这里我依旧使用 Docker：

```
$ docker run -it -p 9999:9999/udp --privileged microros/micro-ros-agent:foxy udp4 -p 9999
```

启动 client 之后我们就可以让 RTT 连接上了：

```
 \ | /
- RT -     Thread Operating System
 / | \     4.0.4 build Jun  9 2021
 2006 - 2021 Copyright by rt-thread team
msh >
msh >microros_pub_int32
[micro_ros] node created
[micro_ros] publisher created
[micro_ros] timer created
[micro_ros] executor created
[micro_ros] New thread mr_pubint32
```

如果一切正常，我们就可以在 client 的输出里看到客户端的连接信息：

```
[1623057529.937043] info     | TermiosAgentLinux.cpp | init                     | running...             | fd: 4
[1623057529.937150] info     | Root.cpp           | set_verbose_level        | logger setup           | verbose_level: 4
[1623057541.764331] info     | Root.cpp           | create_client            | create                 | client_key: 0x6F7B427A, session_id: 0x81
[1623057541.764507] info     | SessionManager.hpp | establish_session        | session established    | client_key: 0x1870348922, address: 0
```

最后当然也还是启动 teleop 用键盘来控制 Kobuki 机器人：

```
$ rosrun teleop_twist_keyboard teleop_twist_keyboard.py
```



# 总结

总的来看，不得不说 ROS1 的 rosserial 初始化过程还是更加简单一些。

另一方面，如果希望能在 RT-Thread 上直接运行 ROS Master 节点，还要期待 RT-Thread Smart。

# References

[1] Gazebo 模拟器: https://www.youtube.com/watch?v=JMVGSxT79rk&t=120s
[2] MicroROS 和 rosseiral 区别: https://micro.ros.org/docs/concepts/middleware/rosserial/
[3] rosserial 软件包: https://github.com/wuhanstudio/rosserial
[4] micro_ros 软件包: https://github.com/wuhanstudio/micro_ros
[5] kobuki 软件包: https://github.com/wuhanstudio/kobuki
[6] rplidar 软件包: https://github.com/wuhanstudio/rplidar

