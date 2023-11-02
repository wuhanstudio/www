Cryptanalysis: 密码分析学
=====================

> 密码分析学是一门非常年轻的学科，目的是为了分析 (破解) 现有的加密算法。

![img](https:/doc.wuhanstudio.cc/cryptanalysis/cryptography.jpg)

## 目录

- **攻击非对称加密 (Asymmetric)**:

  - 整数分解 (Integer Factorization)
  - 离散对数 (Discrete Logarithm)
  - 椭圆曲线 (Elliptic Curve)
  - 量子密码分析 (Quantum Cryptanalysis)
  - 格子 (Lattices)

- **攻击加密协议 (Protocol)**

  - TLS Security Protocol

- **攻击对称加密 (Symmetric)**:

  - 代数攻击 (Algebraic Attacks)
  - 线性密码分析 (Linear Cryptanalysis)
  - 差分密码分析 (Differential Cryptanalysis)

  

## Introduction

之前介绍过，广义密码学 (**Cryptology**) 包括 密码学 (**Cryptography**) 和 密码分析学 (**Cryptanalysis**)。

- [Cryptology: 现代密码学](https://doc.wuhanstudio.cc/cloud.html)

由于密码学 (Cryptography) 在错误的道路上发展了几千年，直到 1949 年（二战结束）才迎来了现代密码学。在此基础上发展的密码分析学，更是一门非常年轻的学科，至今 (2023 年) 也没有一本 Cryptanalysis 的权威教材，大部分 Cryptanalysis 的研究都是以论文的形式发表的。

相比之下，Cryptography 的则有非常多优秀的教材，将密码学相关的论文整理成完整的理论体系：对称加密、非对称加密、加密协议。这篇文章主要参照下面这门课程，总结一下密码分析学。

- [Cryptanalysis SS 2021 - IAIK](www.iaik.tugraz.at/course/cryptanalysis-705068-sommersemester-2021/)

密码分析学不仅研究加密算法的破解，也可以帮助应用决定安全的 Key Size，因此和密码学非常紧密地共同发展。参照密码学分类，常见攻击方式分为针对 **非对称加密 (Asymmetric)，** **对称加密 (Symmetric)** 和 **加密协议 (Protocol)** 的攻击。

这篇文章不会详细介绍算法细节，主要为了理清思路，总结常见的攻击方式。毕竟只要知道关键词，就可以找到原始论文和很多相关资料。之后会单独写一篇文章，以破解 NXP 经典的 NFC Crypto1 为例，详细介绍如何分析破解一个对称加密算法。



## 1. 攻击非对称加密 (Asymmetric)

在开头密码学的文章里介绍过，非对称加密的安全性源自一些非常难的数学问题，加密计算量相对大，一般用来生成公密钥对，大量数据的加密则由简单高效的对称加密完成。

非对称加密的经典三大领域：整数分解 (Integer Factorization)、离散对数 (Discrete Logarithm)、椭圆曲线 (Elliptic Curve)，以及新发展的格子 (Lattices)，下面分别总结不同领域的破解分析方法。

### 1.1 整数分解 (Integer Factorization)

如果给定一个非常大的整数，直接进行分解并不容易，下面的攻击方法很多是基于 Difference-of-Squares Factorization：

$$
\text{Finding}\ p, q: n=p\cdot q \leftrightarrow \text{Finding}\ x, y: x^2 \equiv y^2\ (\text{mod n})
$$

$$
\text{Find}\ x, y\ \text{with}\ x\ne \pm\ y\ \text{(mod n), such that: } x^2\equiv y^2
$$

$$
\text{Then, } (x-y)(x+y)\equiv0 \text{ (mod n), and if we are lucky: gcd}(x\pm y,\ n)\in \{p, q\}
$$

顺便一提，值得注意的是：椭圆曲线 (Elliptic Curve) 既可以用于设计非对称加密，也可以用来破解、加速整数分解，所以 Elliptic Curve 后面没有单独列出一个章节。

- **Factoring with Bases**
  - Dixon's Random Squares Method
  - Quadratic Sieve Method
  - CFRAC

- **Factoring with Continued Fractions**
  - Continued Fractions
  - Wiener's Attack on RSA

- **Factoring with Elliptic Curves**
  - Lenstra's Elliptic Curve Method (ECM)


### 1.2 离散对数 (Discrete Logarithm)

在了解攻击离散对数的方法前，建议先回忆一下什么是 Cyclic Group (G) 以及生成它需要的 generator (g)，和 Elliptic Curve Group。

$$
\text{Goal: Given } y = g^x\text{ in a group }G\text{ of order }\leq n, \text{find } x.
$$

- **General DLP Algorithms**
  - Exhaustive Search
  - Baby Step - Giant Step Method (BSGS)
  - Pollard- Method

- **Special DLP Algorithms for Special Groups**
  - Pohlig-Hellman
  - Index-Calculus
  - Efficient Quantum Algorithms (Shor)


### 1.3 量子密码分析 (Quantum Cryptanalysis)

量子计算机确实可以加速 RSA 的破解，不过当前量子计算机错误率比较高，还没有对整个密码学构成实质威胁 (2023 年)。

另一方面，尽管传统基于 Integer Factorization 的方法 (RSA) 受到了威胁，但是基于 Lattice 的加密方法，既免疫传统计算机的攻击，也免疫量子计算机的攻击。例如 同态加密 (Fully Homomorphic Encryption) 就是基于 Lattice 的加密方法。

比较经典的利用量子计算机攻击 RSA 的方法有：

- **Grover's Algorithm** (Phase Inversion)
- **Shor's Algorithm**

当然，量子计算机发展也很快，现在还处于非常早的阶段，未来并不好说。

### 1.4 格子 (Lattices)

这里简单介绍一下 Lattice：

$$
\text{A subset } \wedge \subseteq R^n \text{is called lattice if there exist R-linearly indepencent basis vectors } b_1, ..., b_d \in R^n \text{ such that:}
$$

$$
\wedge=Zb_1+ ... + Zb_d = \{\sum_{i=1}^{d}{z_b b_i | z_i \in Z}\}
$$

如果形象一点来表示，格子 (Lattices) 就长这样，可以用一组基向量 (Basis Vector) 来表示一个点的集合：

![img](https:/doc.wuhanstudio.cc/cryptanalysis/lattice.png)

![img](https:/doc.wuhanstudio.cc/cryptanalysis/lattice_ax.png)

Lattice 可以构建非对称加密，也可以用来分析破解。

- **NP Hard Problems**
  - Shortest Vector Problem (SVP)
  - Closest Vector Problem (CVP)
  - Bounded Distance Decoding (BDD)
  - Learning With Errors (LWE)

- **Lattice Reduction**
  - LLL Algorithm
  - Bleichenbacher's Attack


值得一提的是上面的 LLL Algorithm 几乎在每一台计算机都默认内置了。



## 2. 攻击加密协议 (Protocol)

一般针对特定的加密协议，有特定的攻击方式，这里只以 TLS 加密协议为例总结：

- BEAST Attack
- CRIME Attack
- Lucky13 Attack
- RC4 Attack



## 3. 攻击对称加密 (Symmetric)

大部分数据是以对称加密算法进行加密的，对称加密又分为 Stream Cipher 和 Block Cipher。其中学术界对 Block Cipher 的设计尤为熟悉，一些 Stream Cipher 也是基于 Block Cipher 设计转换的，所以攻击对称加密有一些通用的分析方法。

### 3.1 差分密码分析 (Differential Cryptanalysis)

对称加密的设计需要满足香农定理 (Shannon's Principle):

> Shannon's Principle: Each input and key bit must influence each output bit in a complicated way.

因此，哪怕只是改变输入数据的一个 bit，也会让输出数据很多位发生改变。但是，一旦 S-Box 设计好之后，对某一个 S-Box 而言，改变某一位造成的变化就是固定的，这样输入和输出的变化关系就会出现一个概率分布。

我们可以分析输入改变和输出改变的对应关系，根据概率分布推测加密数据，甚至还原密钥。

> Differential Cryptanalysis predicts effect of plaintext different $\triangle M=M\oplus M^*$  on ciphertext difference $\triangle C=C+C^*$  without knowing key K.

最初的 Differential Cryptanalysis 可以借由一些求解器完成分析：

- SAT / SMT (Boolean SATisfiability / Sat. Modulo Theories)
- MILP (Mixed Integer Linear Programming)
- CP (Constraint Programming)

之后又出现了很多 Differential Cryptanalysis 的改进版本，根据关键词可以找到很多相关资料，所以这里只是列举比较受欢迎的几个改进，不具体介绍细节：

- Truncated Differentials
- Impossible Differentials
- Boomerang Attack
- Integral Attack (Square Attack)

### 3.2 线性密码分析 (Linear Cryptanalysis)

我们可以用 Linear Equation 来近似一个对称加密算法，例如 $z=x\odot y$ 的真值表：

| Input | Input | Output      |       | Linear | Functions |       |
| ----- | ----- | ----------- | ----- | ------ | --------- | ----- |
| x     | y     | x · y       | 0     | x      | y         | x + y |
| 0     | 0     | 0           | 0     | 0      | 0         | 0     |
| 0     | 1     | 0           | 0     | 0      | 1         | 1     |
| 1     | 0     | 0           | 0     | 1      | 0         | 1     |
| 1     | 1     | 1           | 0     | 1      | 1         | 0     |
|       |       |             |       |        |           |       |
|       |       | Probability | 3 / 4 | 3 / 4  | 3 / 4     | 1 / 4 |

上面列出了用 4 个 Linear Functions 来近似 $z=x\odot y$ 的结果，其中 $z=0$，$z=x$, $z=y$ 的正确率是 3/4，而 $z=x\oplus y$正确率是 1/4。我们可以在此基础上推出 $z=x\oplus y+1$ 的准确率是 3 / 4。

这样用不同的 Linear Functions 去近似一个对称加密算法，就会得到不同的准确率，也可以用一个通用的公式表示：
$$
\alpha x = \beta \bullet S(x)
$$
我们可以估算不同近似公式的准确率，通过分析概率来 Recover Secret Key，也可以使用各种求解器 (MILP，SAT/SMT)：

- Matsui's Algorithm 1
- Matsui's Algorithm 2

值得注意的是，Linear Cryptanalysis 是一个 Known-Plaintext Attack，而前面介绍的 Differential Cryptanalysis 是一个 Chosen-Plaintext Attack。

### 3.3 代数攻击 (Algebraic Attacks)

前面提到的 Differential Cryptanalysis 和 Linear Cryptanalysis 都是基于概率的攻击方式，我们是不是也可以直接把一个 S-Box 用确定的公式来表示呢？

比如下面的 3-Bit S-Box （第一行是 x，第二行是 S(x)，因为表格最多只能插入8列）：

| 0x0  | 0x1  | 0x2  | 0x3  | 0x4  | 0x5  | 0x6  | 0x7  |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| 0x0  | 0x1  | 0x5  | 0x6  | 0x7  | 0x2  | 0x3  | 0x4  |

这个 S-Box 可以用公式表示：

$$
y_1=x_1+x_2+x_3+x_3x_3
$$

$$
y_2=x_1x_2+x_3 
$$

$$
y_3=x_2+x_3+x_1x_3
$$

当然，这个没有考虑和 Secret Key 的运算，我们可以把输入和输出当作已知变量，把 Secret Key 当作未知变量，求解一系列公式来得到 Secret Key，经典的 Algebraic Attack 下面这些方法：

- Interpolation Attack
- High-Order Differentials
- Attacks using Grobner Bases
- AIDA / Cube Attack

之后会以 NFC MFClassic 经典的 Crypto1 为例，介绍如何分析、破解一个对称加密算法。



## **参考文献**

- [Cryptanalysis SS 2021 - IAIK](https://www.iaik.tugraz.at/course/cryptanalysis-705068-sommersemester-2021/)