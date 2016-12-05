# canvas原生实现图片裁剪压缩（支持移动端）
#### 实现原理
1. 用FileReader读取获取的图片文件，并内建一个Image对象，将读取的结果赋给该Image对象；
2. 内建一个canvas，以Image对象为源进行绘制，同时绘制透明效果的背景蒙板；
3. 监听canvas上的mousedown事件，以点击的点为裁剪框的x,y坐标，同时在mousemove的事件，获取鼠标位置，计算裁剪框宽高，绘制裁剪框，并以裁剪框为裁剪区域，绘制图片源，当mouseup时，得到裁剪框的x,y,width,height值；
4. 调用CanvasClip对象的clip方法，内建另一个canvas，以图片源和裁剪框为参数进行绘制，应用toDataURL API对裁剪出的图片进行压缩，获取裁剪图片的base64，并将结果转成blob文件流；
5. 裁剪完成的canvasClip对象上ret64和retBinary分别为裁剪的base64结果和blob文件流。

## 参数配置及使用
* previewContainer：图片源预览的container（dom）
* canvasWidth: 预览canvas的width（默认400）
* source：图片源文件
* quality：压缩质量（默认0.86）

具体使用参见[DEMO](https://crazymary.github.io/canvasClip/canvasClip.html)

