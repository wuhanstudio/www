TCP/UDP 加速、端口映射和组网
========================

> 在大陆无法访问外网，在英国无法访问内网。

不管在哪里，都会碰到各种网络限制。例如网站、端口无法访问，或者访问速度不够快。这篇文章会先介绍如何突破封锁，接下来加速 TCP/UDP 通信。

**不过需要注意的是，下面介绍的方法并不能突破物理限制**。例如从英国访问北京的服务器，跨大洲访问延迟就是在 200ms 左右，如果非要延迟降低到 20ms 就比较为难了；买了一台带宽 5Mbps 云服务器，却希望下载速度达到 50Mbps，也只有花钱升级带宽了。

这里总结一下我碰到的常见应用：

- **内网端口映射**：希望从宿舍访问学校的服务器，却不能直接访问 (nps / frp)。
- **远程局域网**：一台电脑在英国，一台电脑在中国，希望局域网游戏联机或者局域网分享文件 ( wireguard)。
- **TCP 加速**：把 TCP 转换 UDP 后加速 (kcptun)。
- **UDP 加速**：减少 UDP 丢包率，提升传输质量 (UDPspeeder)。

我会用一张图描述问题和解决办法，再给出对应的 GitHub 开源项目，具体的操作可以参照项目文档。毕竟随着软件的更新，一些参数可能发生变动，所以这篇文章不会给出具体的命令（**当然也不能给出，不然会被承德没收违法所得**）。

## 1 内网端口映射

这是一个非常常见的应用场景，在学校有一台服务器，希望从宿舍或者其他地方远程登录服务器，却不能直接访问。

![](https://doc.wuhanstudio.cc/tcp_udp/pro_port.png)

这个时候，如果我们有一台云服务器和公网 IP，从学校和宿舍都能访问这台云服务器，我们就可以把学校服务器的 22 端口，映射到云服务器的 8022 端口。这样就可以通过云服务器的 8022 端口，来访问学校的服务器。

![](https://doc.wuhanstudio.cc/tcp_udp/sol_port.png)

我们可以用 nps 或者 frp 实现端口映射，当然类似的 GitHub 开源项目还有很多，这两个项目的优点在于它们是用 Golang 写的，所以支持不同操作系统 (win / linux / macos) 和不同硬件架构 (arm / amd64 / riscv)。

- nps: https://github.com/ehang-io/nps
- frp:https://github.com/fatedier/frp

这样我们就可以在 nps 的控制台看到端口映射和流量统计：

![](https://doc.wuhanstudio.cc/posts/tcp_udp/nps_console.png)

![](https://doc.wuhanstudio.cc/posts/tcp_udp/nps_client.png)

这里值得注意的是，需要在云服务器和实验室的服务器上同时安装 nps 或者 frp。

当然，我们也可以把远程服务器的端口，映射到 localhost，下面是两个 GitHub 开源项目：

- https://github.com/wangyu-/tinyPortMapper
- https://github.com/rssnsj/portfwd



## 2 远程局域网

不论是远程的局域网文件分享，还是国内外局域网游戏联机，我们需要解决的都是同一个问题：远程局域网。

我们可以把一个房间内的2台电脑，连接到同一个路由器，搭建一个局域网。

那么能不能一台电脑在英国，一台电脑在中国，来组建一个局域网呢？

![](https://doc.wuhanstudio.cc/posts/tcp_udp/pro_lan.png)

当然是可以的，同样是利用一台云服务器，我们可以安装 Wireguard，借助这台云服务器做中转，给分在不同国家的电脑分配一个虚拟局域网 IP，这样互相就可以用局域网分享文件，或者游戏联机了。

![](https://doc.wuhanstudio.cc/posts/tcp_udp/sol_lan.png)

**我们还可以更大胆一点，如果让局域网所有的流量都从云服务器走，那么局域网内所有的主机就都能访问外网了。**

![](https://doc.wuhanstudio.cc/posts/tcp_udp/google.png)

在云服务器上我们可以用 docker 部署 wireguard：

- wg-easy: https://github.com/wg-easy/wg-easy

在个人电脑上则可以安装 wireguard 客户端。

- Wireguard: https://www.wireguard.com/install/



## 3 TCP 加速 (TCP 转 UDP)

前面，我们知道了如何访问不被允许的网站、端口，接下来会介绍如何加速这些应用。

例如 Shadowsocks VPN 用的是 TCP 端口 (也支持 UDP)，我们知道 TCP 连接可信稳定，但是速度会比较慢；UDP  只管发包就是了，不在意数据丢失，所以速度就比较快。

**于是我有了个大胆的想法，如果我们把 TCP 数据包，伪装成 UDP 数据包，是不是就可以提高连接速度了呢**？

![](https://doc.wuhanstudio.cc/posts/tcp_udp/pro_tcp.png)

比如前面提到的内网映射是一个 TCP 连接，我们可以安装 kcptun 把 TCP 数据转换成 UDP 数据，再利用 UDP 通信，这样就大大提高了通信速度。

![](https://doc.wuhanstudio.cc/posts/tcp_udp/sol_udp.png)

当然，也可以用 kcptun 项目的图片直观地解释：

![](https://doc.wuhanstudio.cc/posts/tcp_udp/kcptun.png)

同样的，我们需要在服务器上安装 kcptun，把 TCP 转换成 UDP 发送；也需要在客户端安装 kcptun，把收到的 UDP 再转换回 TCP。

- kcptun: https://github.com/xtaci/kcptun

可能有人会问，既然可以把 TCP 转 UDP，那么能不能把 UDP 转成 TCP 呢？这也是可以的。

- udp2raw: https://github.com/wangyu-/udp2raw

比如说有的云服务器只开放了 80 和 443 的 TCP 端口，我们无法部署 UDP 应用。这个时候就可以把 UDP 伪装成 TCP，通过 TCP 端口发送。



## 4 UDP 加速 (UDP 优化)

我们可以把 TCP 伪装成 UDP 来加速应用，有的应用已经是 UDP 了，是不是就没有提升空间了呢？

对于 UDP 应用，我们还可以通过减少 UDP 通信的丢包率来提升通信质量：

![](https://doc.wuhanstudio.cc/posts/tcp_udp/udpspeeder.png)

同样，我们需要在服务器和客户端都安装 UDPspeeder。

- UDPspeeder: https://github.com/wangyu-/UDPspeeder

这里顺便一提，**TCP 的 8388 端口，和 UDP 的 8388 端口，其实是 2 个端口**。因此我们可以先用 kcptun 把 TCP 转成 UDP 加速，再用 UDPspeeder 优化加速 UDP，这样 TCP 和 UDP 就都加速了，Shadowsocks 的连接速度会实现一个飞跃。




## 总结

这篇文章前两章介绍了如何访问封锁的网站、端口，后两章介绍了如何加速 TCP/UDP 通信，这样我们就能自由、高速地访问各种网络了。

这也是一些商业软件，例如花生壳内网穿透、网游加速器的工作原理（当然这些商业软件，承德建议应当没收违法所得）。

> 顺便一提，在知乎写的文章，不到 30 分钟就被承德认为是非法所得被没收了。