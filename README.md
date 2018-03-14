最近项目中应用到canvas，见识到了canvas技术的强大，突然想到之前用过的开源的裁减库，大多数都是划出一个裁剪框，将坐标点和长宽传到服务端，由后台做裁剪，正好有空，做了个基于canvas的纯前端裁剪压缩工具，支持pc和移动端平台。

## 实现原理
1. 使用原生的URL api 读取本地选取的图片文件（源文件）；
2. 使用canvas的绘图功能（drawImage）将源图片绘制到画板上，两种绘制策略：'CONTAIN'模式等比压缩居中显示；'COVER'模式选取长宽比相对外部container较小的一端适配。类似于background-size属性的cover和contain；
3. 使用鼠标事件使背景画板可移动；
4. 根据裁剪框大小配置在画板中心绘制裁剪框，使其可resize；
5. 当画板移动或resize裁剪框时，动态绘制对应的裁剪区域；
6. 根据质量参数，对裁剪区域使用toDataURL方法压缩裁剪，拿到裁剪图的base64格式，对base64进行blob化处理，最终可输出base64、blob和arrayBuffer格式的裁剪结果。

## 使用说明
对外暴露clip方法，返回一个裁剪对象。
```
const c = clip({
      container, //源文件的外包包裹框--dom
      sourceFile, //源文件--file
      outPutOpt //输出图片的类型和压缩质量参数--object
      showType //画板显示模式--COVER CONTAIN(默认)
    })
// c.clip64:base64结果
// c.clipBlob:blob结果
// c.clipArrayBuffer:arrayBuffer结果
```
[github地址](https://github.com/crazyMary/canvasClip)

[pc demo地址](https://crazymary.github.io/canvasClip/demo)

[mobile demo地址](https://crazymary.github.io/canvasClip/demo/mobile.html)

## 结语
因为时间关系，采用es6编码，没有做很多的兼容性考虑，可能存在一些体验问题。

后期有空了再改进，欢迎指正。

