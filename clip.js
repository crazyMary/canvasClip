(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    //AMD
    define(factory)
  } else if (typeof exports === 'object') {
    //CommonJS
    module.exports = factory()
  } else {
    //浏览器全局变量(root 即 window)
    root.clip = factory()
  }
}(this, function() {

  'use strict'
  const styleText = '.clipWrap {position: relative; overflow: hidden; } .clipWrap .imageBoard {will-change: transform; } .clipWrap .clipContainer {position: absolute; z-index: 1 } .clipWrap .clipContainer span {position: absolute; user-select: none; border: 2px solid #fff } #lbSPAN {cursor: nw-resize; border-right-width: 0; border-bottom-width: 0 } #ltSPAN {cursor: sw-resize; border-right-width: 0; border-top-width: 0 } #rtSPAN {cursor: ne-resize; border-left-width: 0; border-bottom-width: 0 } #rbSPAN {cursor: se-resize; border-left-width: 0; border-top-width: 0 } '
  /*
   *源图的显示模式
   *COVER:覆盖模式
   *CONTAIN:包含模式
   */
  const SHOWTYPE = {
    COVER: 'COVER',
    CONTAIN: 'CONTAIN'
  }

  /*
   *蒙板背景颜色
   */
  const maskBgColor = `rgba(0,0,0,.5)`

  /*
   *默认配置
   */
  const defaultOpt = {
    showType: 'CONTAIN',
    outPutOpt: {
      type: 'image/png',
      quality: .9
    }
  }

  /*
   *裁剪框线数
   */
  const lineCount = 3

  /*
   *移动端判断
   */
  const isMobile = 'ontouchmove' in document.createElement('span')

  /*
   *resize元素的缓冲空间
   */
  const buffer = isMobile ? 20 : 8

  class Clip {

    constructor(opt) {
      /*
       *合并默认配置与私有配置
       */
      opt = Object.assign({}, defaultOpt, opt)

      /*
       *裁减图片container
       */
      this.container = opt.container

      /*
       *源图文件
       */
      this.sourceFile = opt.sourceFile

      /*
       *源图的显示模式
       *COVER:覆盖模式
       *CONTAIN:包含模式
       */
      this.showType = opt.showType


      /*
       *图片输出配置
       */
      this.outPutOpt = opt.outPutOpt

      /*
       *裁减图输出格式
       */
      this.clip64 = ''
      this.clipBlob = null
      this.clipArrayBuffer = null

      /*
       *原图背景canvas
       */
      this.__board = document.createElement('canvas')
      this.__ctx = this.__board.getContext('2d')

      /*
       *裁减区域canvas
       */
      this.__clipContainer = document.createElement('div')
      this.__clipRect = document.createElement('canvas')
      this.__clipCtx = this.__clipRect.getContext('2d')

      /*
       *裁减框长宽配置
       */
      this.__clipSize = {
        w: 100,
        h: 100,
        max: 0,
        min: 4 * buffer
      }

      /*
       *源图背景canvas起始位置
       */
      this.__startPoint = {
        x: 0,
        y: 0
      }

      /*
       *移动背景canvas时的点击位置
       */
      this.__downPoint = {
        x: 0,
        y: 0
      }

      /*
       *背景canvas的可移动x,y范围
       */
      this.__posRange = {
        x: [],
        y: []
      }

      /*
       *背景canvas的坐标位置
       */
      this.__clipRectPos = {
        x: 0,
        y: 0
      }

      /*
       *点击时clip的size
       */
      this.__downClipSize = {
        w: 0,
        h: 0
      }

      /*
       *原图裁剪位置
       */
      this.__srcPos = {
        x: 0,
        y: 0
      }

      /*
       *是否点击canvas,否则不触发move事件
       */
      this.__isMouseDown = false

      /*
       *是否点击在resize框中
       */
      this.__resizeTarget = null


      /*
       *缓存背景canvas
       *用于绘制裁减canvas
       */
      this.__boardImage = null

      this.__init()
      this.__injectStyle()
    }

    __injectStyle(){

      const styles = document.querySelectorAll('style')
      for(let item of styles){
        if(item.id == 'clipStyle')
          return
      }
      const style = document.createElement('style')
      style.type = 'text/css'
      style.id = 'clipStyle'
      style.innerHTML = styleText
      document.head.appendChild(style)
      
    }

    async __init() {
      /*
       *初始化container
       */
      this.__containerInit()

      /*
       *获取源图Image对象
       */
      const sourceImg = await this.__readImage()

      /*
       *获取背景canvas的Image对象
       */
      this.__boardImage = await this.__drawIamge(sourceImg)

      /*
       *绘制蒙板
       */
      this.__drawMask()

      /*
       *背景图canvas可移动
       */
      this.__makeMovable()

      /*
       *添加背景图canvas
       */
      this.container.appendChild(this.__board)

      /*
       *绘制裁剪canvas
       */
      this.__drawClip()
      this.__drawClipMask()

      /*
       *添加裁剪canvas
       *make movable
       */
      this.__clipRectInit()


    }

    __containerInit() {

      this.container.innerHTML = ''
      this.container.style.cssText = `background-color:${maskBgColor}`
      this.container.classList.add('clipWrap')

    }


    __readImage() {

      return new Promise((resolve, reject) => {

        const sourceImg = new Image

        sourceImg.onload = () => {
          URL.revokeObjectURL(this.sourceFile)
          resolve(sourceImg)
        }

        sourceImg.src = URL.createObjectURL(this.sourceFile)

      })

    }

    __setPosRange() {

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const clipSize = this.__clipSize

      const board = this.__board
      const boardWidth = board.width
      const boardHeight = board.height

      const spaceX = (containerWidth - clipSize.w) / 2
      const spaceY = (containerHeight - clipSize.h) / 2
      this.__posRange.x = [-(boardWidth + spaceX - containerWidth), spaceX]
      this.__posRange.y = [-(boardHeight + spaceY - containerHeight), spaceY]

    }

    __drawIamge(sourceImg) {

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const boxRatio = container.clientWidth / container.clientHeight
      const imgRatio = sourceImg.width / sourceImg.height
      let boardWidth, boardHeight, x, y

      const clipSize = this.__clipSize

      const strategyA = function() {
        boardWidth = containerWidth
        boardHeight = boardWidth / imgRatio
        x = 0
        y = (containerHeight - boardHeight) / 2
      }
      const strategyB = function() {
        boardHeight = containerHeight
        boardWidth = boardHeight * imgRatio
        x = (containerWidth - boardWidth) / 2
        y = 0
      }


      if (this.showType === SHOWTYPE.CONTAIN) {
        if (imgRatio >= boxRatio) {
          strategyA()
          this.__clipSize.w = this.__clipSize.h = this.__clipSize.max = boardHeight < containerWidth ? boardHeight : containerWidth
        } else {
          strategyB()
          this.__clipSize.w = this.__clipSize.h = this.__clipSize.max = boardWidth < containerHeight ? boardWidth : containerHeight
        }

      } else if (this.showType === SHOWTYPE.COVER) {
        if (imgRatio >= boxRatio) {
          strategyB()
          this.__clipSize.max = boardHeight
        } else {
          strategyA()
          this.__clipSize.max = boardWidth
        }
      }

      this.__clipRectPos.x = x
      this.__clipRectPos.y = y

      this.__startPoint.x = x
      this.__startPoint.y = y

      const board = this.__board
      board.width = boardWidth
      board.height = boardHeight
      board.classList.add('imageBoard')
      board.style.cssText = `transform:translate3d(${x}px,${y}px,0)`

      this.__setPosRange()
      this.__ctx.drawImage(sourceImg, 0, 0, sourceImg.width, sourceImg.height, 0, 0, boardWidth, boardHeight)

      return new Promise((resolve, reject) => {
        const image = new Image
        image.onload = () => {
          resolve(image)
        }
        image.src = board.toDataURL('image/png')
      })

    }

    __drawMask() {

      const board = this.__board
      const ctx = this.__ctx

      ctx.fillStyle = maskBgColor
      ctx.fillRect(0, 0, board.width, board.height)

    }

    __makeMovable() {

      this.__board.addEventListener('mousedown', this.__down.bind(this), false)
      document.addEventListener('mousemove', this.__move.bind(this), false)
      document.addEventListener('mouseup', this.__up.bind(this), false)

      this.__board.addEventListener('touchstart', this.__down.bind(this), false)
      document.addEventListener('touchmove', this.__move.bind(this), false)
      document.addEventListener('touchend', this.__up.bind(this), false)

    }

    __down(e) {

      this.__downPoint.x = e.pageX
      this.__downPoint.y = e.pageY

      this.__downClipSize.w = this.__clipSize.w
      this.__downClipSize.h = this.__clipSize.h

      this.__isMouseDown = true

      e.preventDefault()

    }

    __move(e) {

      const isMoveAble = this.__isMouseDown && (e.target == this.__board || e.target == this.__clipRect) && (!this.__resizeTarget)

      if (isMoveAble) {
        const posRange = this.__posRange
        const clipRectPos = this.__clipRectPos
        let x = e.pageX + this.__startPoint.x - this.__downPoint.x
        let y = e.pageY + this.__startPoint.y - this.__downPoint.y

        if (x < posRange.x[0]) x = posRange.x[0]
        if (x > posRange.x[1]) x = posRange.x[1]
        if (y < posRange.y[0]) y = posRange.y[0]
        if (y > posRange.y[1]) y = posRange.y[1]

        this.__board.style.cssText = `transform:translate3d(${x}px,${y}px,0)`
        clipRectPos.x = x
        clipRectPos.y = y

        this.__drawClip()
        this.__drawClipMask()

        e.preventDefault()
      }

    }

    __up() {

      const matrixArr = getComputedStyle(this.__board, null)['transform']
        .slice(7, -1).replace(/\s+/g, '').split(',')
        .map(function(item) {
          return parseFloat(item)
        })

      this.__startPoint.x = matrixArr[4]
      this.__startPoint.y = matrixArr[5]

      this.__isMouseDown = false

      document.removeEventListener('mousemove', this.__move)
      document.removeEventListener('mouseup', this.__up)

      document.removeEventListener('touchmove', this.__move)
      document.removeEventListener('touchend', this.__up)

    }

    __drawClip() {

      const clipWidth = this.__clipSize.w
      const clipHeight = this.__clipSize.h

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const left = (containerWidth - clipWidth) / 2
      const top = (containerHeight - clipHeight) / 2

      const board = this.__board
      const clipContainer = this.__clipContainer

      const clipRect = this.__clipRect
      const clipCtx = this.__clipCtx

      this.__srcPos.x = left - this.__clipRectPos.x
      this.__srcPos.y = top - this.__clipRectPos.y

      clipCtx.clearRect(0, 0, containerWidth, containerHeight)

      clipRect.width = clipWidth
      clipRect.height = clipHeight


      clipCtx.drawImage(this.__boardImage, this.__srcPos.x, this.__srcPos.y, clipWidth, clipHeight, 0, 0, clipWidth, clipHeight)

      clipContainer.style.cssText = `left:${left}px;top:${top}px;width:${clipWidth}px;height:${clipHeight}px;`
      clipContainer.classList.add('clipContainer')

      this.__setPosRange()

    }

    __drawClipMask() {
      const clipCtx = this.__clipCtx
      const clipWidth = this.__clipRect.width
      const clipHeight = this.__clipRect.height

      clipCtx.strokeStyle = '#fff'

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j <= lineCount; j++) {
          let moveX, moveY, lineX, lineY, lw
          if (i == 0) {
            lineY = moveX = 0
            moveY = clipWidth * j / lineCount
            lineX = clipWidth
          } else if (i == 1) {
            moveX = clipHeight * j / lineCount
            lineX = moveY = 0
            lineY = clipHeight
          }
          lw = (i == 0 && j == 0 || i == 0 && j == lineCount || i == 1 && j == 0 || i == 1 && j == lineCount) ? 4 : 1
          clipCtx.save()
          clipCtx.lineWidth = lw
          clipCtx.translate(moveX, moveY)
          clipCtx.beginPath()
          clipCtx.moveTo(0, 0)
          clipCtx.lineTo(lineX, lineY)
          clipCtx.stroke()
          clipCtx.restore()
        }
      }

    }

    __clipRectInit() {

      const canvas = this.__clipRect
      const clipContainer = this.__clipContainer

      function createSpan(id) {
        const span = document.createElement('span')
        const css = `width:${2*buffer}px;height:${2*buffer}px;z-index:2`
        const space = -4
        switch (id) {
          case 'lbSPAN':
            {
              span.style.cssText = `${css};left:${space}px;top:${space}px;`
              break
            }
          case 'ltSPAN':
            {
              span.style.cssText = `${css};left:${space}px;bottom:${space}px;`
              break
            }
          case 'rtSPAN':
            {
              span.style.cssText = `${css};right:${space}px;top:${space}px;`
              break
            }
          case 'rbSPAN':
            {
              span.style.cssText = `${css};right:${space}px;bottom:${space}px;`
              break
            }
        }
        span.id = id
        clipContainer.appendChild(span)
      }

      ['ltSPAN', 'lbSPAN', 'rtSPAN', 'rbSPAN'].forEach(createSpan)

      // 点击事件委托给父元素
      clipContainer.addEventListener('mousedown', this.__down.bind(this), false)
      clipContainer.addEventListener('mousedown', this.__bindClipEvent.bind(this), false)

      clipContainer.addEventListener('touchstart', this.__down.bind(this), false)
      clipContainer.addEventListener('touchstart', this.__bindClipEvent.bind(this), false)

      clipContainer.appendChild(canvas)
      this.container.appendChild(clipContainer)
    }

    __bindClipEvent(e) {

      this.__resizeTarget = e.target.id

      document.addEventListener('mousemove', this.__clipRectResize.bind(this), false)
      document.addEventListener('mouseup', this.__clipRectUp.bind(this), false)

      document.addEventListener('touchmove', this.__clipRectResize.bind(this), false)
      document.addEventListener('touchend', this.__clipRectUp.bind(this), false)

      e.preventDefault()
    }

    __clipRectResize(e) {

      if (this.__isMouseDown && this.__resizeTarget) {

        const clipRect = this.__clipRect

        const offX = e.offsetX
        const offY = e.offsetY
        const disX = (e.pageX - this.__downPoint.x) * 2
        const disY = (e.pageY - this.__downPoint.y) * 2

        const clipW = clipRect.width
        const clipH = clipRect.height

        const downClipSize = this.__downClipSize
        const clipSize = this.__clipSize

        if (this.__resizeTarget == 'ltSPAN' || this.__resizeTarget == 'lbSPAN') {
          clipSize.w = clipSize.h = downClipSize.w - disX
        } else {
          clipSize.w = clipSize.h = downClipSize.w + disX
        }

        if (clipSize.w < clipSize.min || clipSize.h < clipSize.min) {
          clipSize.w = clipSize.h = clipSize.min
        } else if (clipSize.w > clipSize.max || clipSize.h > clipSize.max) {
          clipSize.w = clipSize.h = clipSize.max
        }

        this.__drawClip()
        this.__drawClipMask()

        e.preventDefault()

      }


    }

    __clipRectUp() {

      this.__resizeTarget = null

      document.removeEventListener('mousemove', this.__clipRectResize)
      document.removeEventListener('mouseup', this.__clipRectUp)

      document.removeEventListener('touchmove', this.__clipRectResize)
      document.removeEventListener('touchend', this.__clipRectUp)

    }

    async getClip() {

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const clipSize = this.__clipSize
      const clipWidth = clipSize.w
      const clipHeight = clipSize.h

      canvas.width = clipWidth
      canvas.height = clipHeight

      ctx.drawImage(this.__boardImage, this.__srcPos.x, this.__srcPos.y, clipWidth, clipHeight, 0, 0, clipWidth, clipHeight)

      this.clip64 = canvas.toDataURL(this.outPutOpt.type, this.outPutOpt.quality)

      const binary = await this.__outPutBinary()
      this.clipBlob = binary.blob
      this.clipArrayBuffer = binary.arrayBuffer

      return Promise.resolve()

    }

    __outPutBinary() {

      const self = this
      return new Promise(function(resolve, reject) {

        const clip64Arr = self.clip64.split(',')
        const type = clip64Arr[0].match(/:(.*?);/)[1]
        const str = atob(clip64Arr[1])
        let len = str.length

        const ab = new ArrayBuffer(len)
        const dv = new Uint8Array(ab)

        while (len--) {
          dv[len] = str.charCodeAt(len)
        }

        resolve({
          blob: new Blob([dv], {
            type
          }),
          arrayBuffer: dv.buffer
        })

      })

    }

    exportImage(){
      const a = document.createElement('a')
      a.download = 'clip__image'
      a.href = this.clip64
      a.click()
    }

    reset() {
      this.__clipSize = {
        w: 100,
        h: 100,
        max: 0,
        min: 2 * buffer
      }
      this.__init()
    }

  }

  function clip(container, sourceFile, showType) {

    return new Clip(container, sourceFile, showType)

  }

  return clip

}))
