CV 库函数 - 不要误用卷积 (Convolution)
=======================================

虽然之前 Workshop 特意强调了 Convolution 和 Cross-Correlation 的区别，然而不出意外，学生提交的作业依旧是群魔乱舞，10 份作业能有 7 份不同的卷积计算方式，每种方式算的结果还都不一样。

> Convolution 和 Cross-Correlation 的区别可以看之前的一篇文章 [链接](https://doc.wuhanstudio.cc/posts/convolution.html)。

于是决定总结一下，如何用不同的 CV 库 （OpenCV，scipy）得到相同的正确结果。

- cv2.Sobel  (Convolution)
- cv2.filter2D (**Cross-Correlation**)
- scipy.signal.convolve2d (Convolution)
- scipy.ndimage.convolve (Convolution)

其实，需要注意的就是 OpenCV 的 filter2D 这个函数与众不同，也是 CV 领域很多人的误解。

另外，实际使用的时候我们需要 **注意输入类型避免用 np.uint8**，因为有些函数 (scipy.ndimage.convole) 默认不会转换数据类型，如果用 uint8 计算溢出了，并不会报错，以至于很多学生算出来的图像看起来是对的，但实际数据是错的。



## 测试输入

首先， 我们需要定义相同的输入，也就是下面这张黑白图片，用 卷积 (Convolution) 来计算图片各个方向的 梯度 (Gradient)。

```
import cv2
gr_im = cv2.imread("shapes.png", cv2.IMREAD_GRAYSCALE)
```

由于在 CV 领域，尤其是 Deep Learning，很多人把 Convolution 和 Cross-Correlation 混用，而 信号处理 (Signal Processing) 领域 基本不会有人犯这个错误，所以我们以 Signal Processing 为标准：**计算卷积前，需要把 Kernel 上下左右翻转**。

其次，我们需要定义相同的 Kernel，以经典的 Sobel Filter 为例，用的是标准的 Convolution Kernel 来计算 x 方向的梯度：

$$
k_{conv}=\begin{bmatrix}
+1 & 0 & -1\\
+2 & 0 & -2\\
+1 & 0 & -1
\end{bmatrix} (a.k.a. \text{Sobel Kernel})
$$

当然， 对于 CV 领域的很多库函数，如果我们想得到相同的结果，需要将 $k_{conv}$ 上下左右翻转，得到 $k_{cross}$ 作为输入的 kernel。

$$
k_{cross}=\begin{bmatrix}
-1 & 0 & +1\\
-2 & 0 & +2\\
-1 & 0 & +1
\end{bmatrix}
$$

![](conv_lib/shapes.png)

```
# Convolution (Sobel Filter)
kx_conv = np.array([
    [1, 0, -1], 
    [2, 0, -2], 
    [1, 0, -1]
])

# Cross-Correlation
kx_cross = np.array([
    [-1, 0, 1], 
    [-2, 0, 2], 
    [-1, 0, 1]])

# kx_cross = np.flip(np.flip(kx_conv, 0), 1)
```



## 方法 1: cv2.Sobel (Convolution)

我们用 Sobel Filter 计算 $x$ 方向的梯度，作为标准答案，这里输入是 $k_{conv}$：
$$
G_x = Image\ \ast \ k_{conv}
$$

$$
k_{conv}=\begin{bmatrix}
+1 & 0 & -1\\
+2 & 0 & -2\\
+1 & 0 & -1
\end{bmatrix}
$$
```
Gx = cv2.Sobel(gr_im, cv2.CV_64F, 1, 0, ksize=3)
```

由于 Sobel Filter 的 kernel 是标准定义好的，所以在函数输入里并不需要指定 Kernel 的具体参数，只要给出 size 就可以了，并且 (1, 0) 代表计算 x 方向的梯度，(0, 1) 则是计算 y 方向的梯度，为了避免溢出，我们需要指定数据类型 cv2.CV_64F。



## 方法 2: cv2.filter2D (Cross-Correlation)

由于 **cv 领域的 filter 其实是 Cross-Correlation**，为了得到和上面一样的输入，我们需要给定的是 $k_{cross}$：
$$
G_x = Image\ \otimes \ k_{cross}
$$

$$
k_{cross}=\begin{bmatrix}
-1 & 0 & +1\\
-2 & 0 & +2\\
-1 & 0 & +1
\end{bmatrix}
$$

```
Gx = cv2.filter2D(gr_im, cv2.CV_64F, kx_cross)
```



## 方法 3: scipy.signal.convolve2d (Convolution)

这是 Signal Processong 领域的库函数，所以我们用标准的 $k_{conv}$ 就可以了。
$$
G_x = Image\ \ast \ k_{conv}
$$

```
Gx = convolve2d(gr_im, kx_conv, mode='same')
```

不过这里需要注意的是，之前没有提过 Convolution 在边界的处理方式。为了让输和输入有相同的维度，我们需要对输入图片做 Padding，**一般默认使用相同的 0 Padding**，常见的模式有下面几种：

```
-‘constant’ (k k k k | a b c d | k k k k) (默认)

-‘reflect’  (d c b a | a b c d | d c b a)
-‘nearest’  (a a a a | a b c d | d d d d)
-‘mirror’   (d c b | a b c d | c b a)
- ‘wrap’    (a b c d | a b c d | a b c d)
```



## 方法 4: scipy.ndimage.convolve (Convolution)

这也是 Signal Processing 领域的函数，用的是标准的 $k_{conv}$：
$$
G_x = Image\ \ast \ k_{conv}
$$

```
Gx = ndimage.convolve(gr_im.astype(float), kx_conv)
```

这个函数需要 **注意输入类型**，就像前面提到的那样，如果输入图像是 np.uint8，计算过程会溢出，但并不会报错，如果靠看输出的图像，很难发现错误。



## 总结

主要学生犯的错误就是混淆了 Convolution 和 Cross-Correlation，或者没有注意 np.uint8 溢出了。

```
Gx = cv2.Sobel(gr_im, cv2.CV_64F, 1, 0, ksize=3)
Gx = cv2.filter2D(gr_im, cv2.CV_64F, kx_cross)
Gx = convolve2d(gr_im, kx_conv, mode='same')
Gx = ndimage.convolve(gr_im.astype(float), kx_conv)
```

