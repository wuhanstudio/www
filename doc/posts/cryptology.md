Cryptology: 现代密码学
===================

> 曾经以为密码学是一门非常古老的学科，实际上现在 (2022年) 用的大部分加密算法都是最近 50 年内提出来的。密码学在错误的道路上发展了几千年，直到 1949 年（二战结束）才迎来了现代密码学。**Cryptology 分为 Cryptography 和 Cryptanalysis**，前者专注于加密，后者专注于破解。

## 目录

- **密码学 (Cryptography)**
- **对称加密 (Symmetric Encryption)**

  - 流加密 (Stream Cipher)
  - 块加密 (Block Cipher)

- **非对称加密 (Asymmetric Encryption)**

  - 整数分解 (Integer Factorization)
  - 离散对数 (Discrete Logarithm)
  - 椭圆曲线 (Elliptic Curve)
  - 格密码 (Lattice Based)

- **加密协议 (Protocols)**

  - 数字签名 (Digital Signature)
  - 消息认证 (Message Authentication)
  - 密钥制定 (Key Establishment)

- Examples

  - TRIVIUM 对称加密 - Stream Cipher
  - PRESENT 对称加密 - Block Cipher

- **密码分析学 (Cryptanalysis)**

  - CRYPTO1: 密码分析学 - Hardnested Attack

  

## Cryptology

最近 (半年前) 认真地看完了 Prof. Christof Paar 的经典密码学教材 [1]，对密码学的整体走向豁然开朗，突然觉得密码学是一门很有意思的学科，也对自己的科研有了很大的启发 (Man-in-the-Middle Attack)。这篇文章也是总结一下看完这本书后的收获，例如以后需要在嵌入式设备上安全高效地加密的时候，能知道该使用什么加密方法。

首先需要说明，Cryptology 和 Cryptography 都被翻译成了密码学，但它们其实是 2 个学科，下面这张图很清楚地说明了它们之间的关系。**Cryptology 分为 Cryptography 和 Cryptanalysis**，前者专注于加密，后者专注于破解。一般大家说密码学指 Cryptography，尝试破解的则是密码分析学 Cryptanalysis 。

![img](https://doc.wuhanstudio.cc/posts/cryptology/cryptology.jpg)



## Cryptography

前面提到，这里的密码学是指注重加密的 Cryptography，它又可以细分为三个部分：

- 密码学 (Cryptography)
- 对称加密 (Symmetric Encryption)
- 非对称加密 (Asymmetric Encryption)
- 加密协议 (Protocols)



**对称加密 (DES, 3DES, AES)：**如果要加密一串消息，很自然的想法是，加密和解密用的同一个密码。如同现实生活中，一把钥匙既可以锁上一把锁，也可以打开一把锁，这就是密码学中的对称加密 (Symmetric Encryption)：加密和解密用的是同一串密钥 (Secret Key)。实际应用中的数据加密，通常都是使用的对称加密，因为**对称加密算法很多对硬件特别友好，所以在硬件加密模块上运行效率非常高**。

**非对称加密 (RSA)：**直到 1976 年，才出现了非对称加密 (Asymmetric Encryption)，也就是加密和解密用的不同的密钥。例如现实生活中，某个人家门前的信箱，每个人都可以往信箱里放信件，但是只有用私人的钥匙才能够打开信箱。**非对称加密的提出让密码学又进入了一个全新的阶段**，但是这并不意味着原先的对称加密会被替换，实际上非对称加密是为了解决对称加密无法解决的问题。例如，怎么才能保证使用密钥的人是可信的呢？Alice 和 Bob 使用相同的密钥进行加密和解密，如果有其他人拿到了密钥，也可以假装自己是 Alice 和 Bob 来骗取信息。非对称加密就可以使用数字签名来确保自己是和可信的人交流的，比如浏览器的 TLS 证书可以确保我们打开的是官方网站。然而，**非对称加密的运行速度非常慢，远远慢于对称加密**，所以通常非对称加密只用来加密很小的一块数据 (秘钥生成)，大部分数据的加密还是交给对称加密算法。

**加密协议：**光有加密方法是不行的，怎么交换密钥，怎么确保消息没有被篡改，我们还需要设计加密协议 (Protocol)，这又包含 3 个部分：数字签名 (Digital Signature)，消息认证 (Message Authentication)，密钥制定 (Key Establishment)。例如浏览器的 TLS 实际上是很多加密算法的组合，来保证浏览器的通信安全。

下面这张图非常清晰地列出了密码学的发展路程 [2]。最早 1974 年使用的标准是 **高效的对称加密 (DES)**，1979 年之后出现了 **非对称加密 (RSA)**，再之后 1989 年出现各种 **加密协议，**而如今在量子计算机的推动下，又开始应用更安全的非对称加密，例如椭圆曲线 (Elliptic Curve, 2004-2005)，格密码 (Lattice Based, 2009)。

![img](https://doc.wuhanstudio.cc/posts/cryptology/cryptography.png)



## 总结

这篇文章只是简单地介绍了现代密码学的组成部分，之后（明年后）还会以 **Trivium 流加密**，**Present 块加密**，**Crypto1 破解** 为例，详细介绍 **密码学** (Cryptography) 和 **密码分析学**(Cryptanalysis)。



## 参考文献

[1] Paar, Christof, and Jan Pelzl.*Understanding cryptography: a textbook for students and practitioners*. Springer Science & Business Media, 2009.

[2] Zapechnikov, Sergey, Alexander Tolstoy, and Sergey Nagibin. "History of Cryptography in Syllabus on Information Security Training."*IFIP World Conference on Information Security Education*. Springer, Cham, 2015.