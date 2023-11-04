Proxmox 搭建 k3s 集群 (负载均衡)
============================


> Proxmox 搭建轻量级的 Kubernetes (k8s) 集群 K3S。

二十多年前，网站服务器很多是裸搭的 LAMP 环境 (Linux，Apache，MySQL，PHP），需要自己维护升级各种软件和配置。一旦服务器需要升级，就得手动更新各种配置文件、迁移数据，非常头大。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/lamp.png)


**2013 年出现了 Docker 容器，把软件和数据分开，从此软件升级不再那么头疼。**Docker 迅速席卷全球，很快几乎所有的云服务都进入了 Docker 的时代。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/docker.png)



随着 Docker 时代的到来，大家也逐渐担心 Docker 作为一个商业公司，会不会就此垄断云服务，我们把整个世界都放在了一个篮子里，万一自己的公司和 Docker 合作闹了矛盾怎么办。

于是 Google 出面决定制定一个开放的容器标准 Open Container Initiative (OCI)，并且推出了 Kubernetes (k8s) 管理架构，只要是兼容 OCI 的容器，就能使用 Kubernetes (k8s)。于是，我们又有了 Kata Container，runC 等开源的实现，Docker 也从唯一的选择，成为了众多选择之一。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/kubernetes.png)



**如今，我们又迎来了 Kubernetes (k8s) 的世界**，几乎所有公司的云服务都开始用 k8s 管理。

> Kubernetes 又称 k8s，这是经典的 Google 命名法，第一个字母 k，到最后一个字母 s，中间有8个字母。

**然而，我这篇文章要搭建的是 k3s**，从名字来看，3 只有 8 的右半边，可以大胆猜测 k3s 是一个轻量级的 k8s。因为 k8s 虽然很强大，支持无缝对接 AWS，Azure，GCloud 等公有云，但是运行一个主节点至少需要双核4G的配置，而对于一些个人私有云而言，不需要的功能浪费了大量资源。

**于是，经过裁剪的 k8s 变成了 k3s，**我们甚至可以在一个树莓派上运行轻量级的 k3s，并且和 k8s 一样使用 kubectl 管理集群。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/k3s.png)



## 0. 最终目的

这篇文章的目的，则是把 Mac Mini 改造成一个私有云，并且在上面新建虚拟机，组成 k3s 集群，部署一个网站服务器 (nginx) ，同时支持负载均衡 (MetalLB)，自动更新 HTTPS 证书 (CertManager，Traefik)，也就是下面的架构图，有一个基本的企业级应用了。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/intro.png)


为此，我们分成三部实现这个架构：

1. 安装 Proxmox 私有云：这样我们就可以自由地新建虚拟机；
2. 搭建 k3s 集群：组建 k3s 集群，利用 kubectl 管理集群；
3. 部署应用：在 k3s 集群上部署应用：MetalLB，Traefik，CertManager，Nginx。

后面搭建集群需要用到的命令和配置文件，我都放在了 Github 仓库里。

- [GitHub - k3s-proxmox-cluster](https://github.com/wuhanstudio/k3s-proxmox-cluster)

## 1. Proxmox 私有云

Proxmox 其实就是基于 Debian 的一个 Linux 发行版，所以我们直接把 Proxmox 当作 Linux 安装就可以了。

不过值得注意的是，Proxmox 官方镜像必须擦除整个磁盘安装，所以如果不想丢失已有的系统，可以先手动分区安装 Debian，再在 Debian 的基础上安装 Proxmox。

- Debian 安装 Proxmox:[Install Proxmox VE on Debian 11 Bullseye](https://link.zhihu.com/?target=https%3A//pve.proxmox.com/wiki/Install_Proxmox_VE_on_Debian_11_Bullseye)

如果不想格式化 U盘，这里推荐一个 U盘安装系统的工具 Ventoy，我们只需要把不同的 ISO 镜像复制到 U盘里，Ventoy 就会自动生成启动项，利用一个 U盘启动不同的操作系统 ISO。

Ventoy - A new bootable USB solution.github.com/ventoy/Ventoy

安装好 Proxmox 后，我们就可以从服务器的 8006 端口 (**这是 HTTPS 的协议**)，在网页上访问虚拟机了。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/proxmox.png)



### 1.1 桥接网络 (Bridge)

我们需要给新建的虚拟机分配 IP，而我的 Mac Mini 直接连接到了路由器，所以打算创建一个桥接网络，这样虚拟机就可以直接从路由器 DHCP 获取 IP，看起来就好像虚拟机直接有线网连到了路由器一样。

比如我路由器的 LAN 子网是 192.168.1.0/24，Proxmox 连到路由器可能有个 IP: 192.168.1.3，Proxmox 云平台里新建的虚拟机可以分配到 192.168.1.101，和 Proxmox 是平级的。

在 Proxmox 的 System --> Network --> Create --> Linux Bridge，填入下面的配置，当然 IPv4 网段和 网卡 enp2s0f0 根据自己的实际情况需要调整。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/proxmox_bridge.png)



### 1.2 虚拟机镜像

我后面用的  Ubuntu 20.04 组建 HPC 节点，登录到 Proxmox 控制台后，下面的命令下载 Ubuntu Cloud Image，并且创建一个 VM Template，这样后面创建虚拟机就可以一键复制模板，类似 AWS 的 t2, t3 模板:

- t2.nano (1 vCPU and 0.5 GiB memory)
- t2.micro (1 vCPU and 1 GiB memory)
- t2.small (1 vCPU and 2 GiB memory)

```
# Log into Proxmox

# Create Ubuntu Cloud Image
$ curl -O http://cloud-images.ubuntu.com/releases/focal/release/ubuntu-20.04-server-cloudimg-amd64.img
$ sudo apt install libguestfs-tools -y
$ sudo virt-customize -a ubuntu-20.04-server-cloudimg-amd64.img --install qemu-guest-agent --truncate /etc/machine-id 

# Create a template VM
$ sudo qm create 9000 \
         --name ubuntu-20.04-cloud-init --numa 0 --ostype l26 \
         --cpu cputype=host --cores 1 --sockets 1 \
         --memory 1024  \
         --net0 virtio,bridge=vmbr0

# Replace local with your local storage (e.g. local-lvm)
$ sudo qm importdisk 9000 ubuntu-20.04-server-cloudimg-amd64.img local  -format qcow2
$ sudo qm set 9000 --scsihw virtio-scsi-pci --scsi0 /var/lib/vz/images/9000/vm-9000-disk-0.qcow2
$ sudo qm resize 9000 scsi0 +6G
$ sudo qm set 9000 --ide2 local:cloudinit
$ sudo qm set 9000 --boot c --bootdisk scsi0
$ sudo qm set 9000 --serial0 socket --vga serial0
$ sudo qm set 9000 --agent enabled=1
```

这样我们在 Proxmox 里就有了一个 Ubuntu 20.04 (1核1G，8G硬盘) 的模板。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/proxmox_cloud_init.png)

在上面图中的 Cloud-Init 选项里，我们可以配置虚拟机默认的用户名和密码，还有 SSH Key，这样我们虚拟机开机就可以直接登录，类似 AWS 新建一个 EC2 节点后会让你下载登录用的 pem 密钥。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/proxmox_ssh.png)

最后把我们前面的配置，转换成一个虚拟机模板。

```
$ qm template 9000
```



### 1.3 创建虚拟机

有了前面创建的模板，我们就可以创建3个Ubuntu 虚拟机，作为 HPC 的节点。

```
$ qm clone 9000 100 --name Ubuntu-20.04-master --full
$ qm clone 9000 101 --name Ubuntu-20.04-worker1 --full
$ qm clone 9000 102 --name Ubuntu-20.04-worker2 --full
```

这样3条命令，我们就有了3个 Ubuntu 虚拟机，分别为 manager, compute01, compute02，开机后 Proxmox 会利用前面的 Linux Bridge 帮它们从路由器申请 IP，我们可以登录到虚拟机修改主机名。

```
$ ssh ubuntu@192.168.1.130
$ sudo hostnamectl set-hostname master

$ ssh ubuntu@192.168.1.114
$ sudo hostnamectl set-hostname worker1

$ ssh ubuntu@192.168.1.115
$ sudo hostnamectl set-hostname worker2
```

## 2. k3s 集群

有了 3 个 Ubuntu 虚拟机后，我们就可以用 k3sup 来迅速组建一个 k3s 集群了，为此我们需要在**自己的电脑**上安装 k3sup 工具，借助个人电脑，自动配置虚拟机的 k3s 集群。

```
# On your Local PC
$ curl -sLS https://get.k3sup.dev | sh
$ sudo install k3sup /usr/local/bin/
```

前面创建虚拟机模板的时候，我上传了自己电脑的 ssh key，所以我可以免密码 ssh 登录虚拟机，这样西门三行命令就组建好了一个 k3s 集群。

```
# Make sure you can ssh into each machine without password

# k3s master
# You may consider increasing the memory of the master node to be 2GB 
$ k3sup install --ip 192.168.1.130 --user ubuntu

# k3s worker1
$ k3sup join --ip 192.168.1.114 --server-ip 192.168.1.130 --user ubuntu

# k3s worker2
$ k3sup join --ip 192.168.1.115 --server-ip 192.168.1.130 --user ubuntu
```

于是我们可以用 kubectl 管理刚刚创建的 k3s 集群：

```
# Test your cluster with:
$ export KUBECONFIG=/home/wuhanstudio/kubeconfig
$ kubectl config use-context default
$ kubectl get node -o wide
```

可以看到3个节点的状态：

```
NAME      STATUS   ROLES                  AGE   VERSION
master    Ready    control-plane,master   53m   v1.25.3+k3s1
worker1   Ready    <none>                 50m   v1.25.3+k3s1
worker2   Ready    <none>                 46m   v1.25.3+k3s1
```

假如很不幸安装过程出了什么问题，例如 GitHub，Google 打不开，建议直接清除重装。

```
# To uninstall K3s from a server node, run:
$ /usr/local/bin/k3s-uninstall.sh

# To uninstall K3s from an agent node, run:
/usr/local/bin/k3s-agent-uninstall.sh
```

到这里，我们就有了一个 k3s 集群，接下来就可以用 kubectl 部署应用了。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/kubernetes_console.png)



## 3. 部署应用

无论是 k8s 还是 k3s，我们都是用 kubectl 部署应用，所以一些 k8s 的应用可以直接安装到 k3s 集群。

我们需要安装3个应用：

- MetalLB：用来做负载均衡，自动把流量请求分配到不同的节点，并赋予节点 IP；
- Traefik：我们希望 [a.myapp.uk](http://a.myapp.uk/) 和 [b.myapp.uk](http://b.myapp.uk/) 分别跳转两个不同的网站，但是两个域名都解析到同一台服务器，所以需要 Traefik 相当于门卫，根据请求的域名不同，把请求转发到 k3s 集群内的不同节点；
- CertManager：对于企业级应用，当然希望自动生成 HTTPS 证书。



### 3.1 安装 MetalLB

其实后面的步骤几乎一模一样，无非就是 kubectl apply -f xxx.yml ，例如安装 MetalLB 就是应用了2个 YAML 文件。

```
# On your local PC
$ kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.7/config/manifests/metallb-native.yaml

# Please change the IP pool in the YML file
$ kubectl apply -f 3-deployment/1-metallb/metallb-configs.yml
```

第一个是 MetalLB 官方的配置，第二个则是我的配置文件，因为负载均衡需要给不同的节点分配 IP，如果是 AWS 和 Azure 等云平台，它们提供 Load Balancer 给虚拟器分配公网 IP。

然而，我这是在自己的私有云上搭建 k3s 集群，并没有公网 IP，所以 MetalLB 的作用就是把局域网的 IP 分配给不同虚拟机节点，下面我就预留了 192.168.1.200-192.168.1.254 分配给虚拟机。 

```
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: first-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.200-192.168.1.254
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: example
  namespace: metallb-system
```



### 3.2 安装 Traefik

我们希望 whoami.wuhanstudio.local 和 hello.wuhanstudio.local 都解析到一个虚拟机节点，然后这个节点根据请求的域名不同，把实际的请求转发到另外的2个节点上，实现 Ingress Control，配置起来也就是 kubectl apply 一系列的 YAML 文件。 

```
$ cd k3s-proxmox-cluster/3-deployment/2-traefik
$ kubectl apply -f 00-role.yml \
                -f 00-account.yml \
                -f 01-role-binding.yml \
                -f 02-traefik.yml \
                -f 02-traefik-services.yml

# You can change the domain name in YML file
$ kubectl apply -f 03-whoami-app.yml \
                -f 03-whoami-ingress.yml \
                -f 03-hello-world.yml \
                -f 03-hello-ingress.yml
```

这里简单解释一下配置文件，例如 03-hello-ingress.yml 这个文件里就定义了如果请求的域名 host 是 hello.wuhanstudio.local，就把它转发到 hello-world 这个 service。

```
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello-ingress
spec:
  rules:
  - host: hello.wuhanstudio.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hello-world
            port:
              name: web
```

而 hello-world 这个网站则是在 03-hello-world.yml 这个文件里定义的 Docker 镜像和端口。 

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-world
  labels:
    app: hello
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hello
  template:
    metadata:
      labels:
        app: hello
    spec:
      containers:
      - image: tutum/hello-world:latest
        name: hello-world
        ports:
          - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: hello-world
spec:
  ports:
    - name: web
      port: 80
      targetPort: 80
  selector:
    app: hello
  type: ClusterIP
```



### 3.3 安装 CertManager

尽管我们是一个局域网的 k3s 集群，我还是希望像企业级应用一样，自动更新 HTTPS 证书，所以我们需要安装 CertManager 管理 HTTPS 证书。

```
$ cd k3s-proxmox-cluster/3-deployment/3-cert-manager

$ kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.10.0/cert-manager.yaml

# Use cmctl to verify the API installation
$ cmctl check api 

$ kubectl apply -f 04-cert-manager-config.yml
```

安装好 CertManager 之后，我们需要给2个应用：hello，whoami 生成证书。

```
$ kubectl apply -f 05-hello-tls-ingress.yml \
                -f 05-whoami-tls-ingress.yml
```

以 hello 为例，我们在 05-hello-tls-ingress.yml 只是定义了证书的名字、域名、self-signed 的形式发放局域网证书。 

```
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello-tls
  annotations:
    kubernetes.io/ingress.class: "traefik"
    cert-manager.io/cluster-issuer: selfsigned-issuer
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  tls:
  - hosts:
    - hello.wuhanstudio.local
    secretName: hello-tls
  rules:
    - host: hello.wuhanstudio.local
      http:
        paths:
          - path: /
            pathType: ImplementationSpecific
            backend:
              service:
                name: hello-world
                port:
                  number: 80
```

最后，我们可以确认证书是否顺利发放了。

```
$ kubectl get pods --namespace cert-manager
$ kubectl describe secret hello-tls
$ kubectl describe secret whoami-tls
```

可以看到，虽然2个域名都是解析到了 192.168.1.130 这个 IP 地址，但是我们直接访问 IP 地址会得到 404 页面，只有访问对应的域名，才会返回 HTTPS 加密的网站。

![img](https://doc.wuhanstudio.cc/posts/proxmox_k3s/app.png)



## 总结

我们安装了 Proxmox 私有云创建了3个 Ubuntu 虚拟机，并用 k3sup 组建了一个 k3s 集群；最后用 MetalLB 给不同节点动态分配 IP，利用 Traefik 负载均衡，把不同的域名重定向到对应的节点，并用 CertManager 自动生成 HTTPS 证书。

虽然这是一个 Mac Mini 改造的私有云 k3s 集群，但是不亚于企业级的标准，负载均衡 (Load Banlander)，Traefik (Ingress Controller)，证书管理 (CertManager)应有尽有。

搭建 k3s 集群需要用到的命令和配置文件，我都放在了 Github 仓库里。

- [GitHub - k3s-proxmox-cluster](https://github.com/wuhanstudio/k3s-proxmox-cluster)