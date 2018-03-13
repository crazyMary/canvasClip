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
  /*
   *源图的显示模式
   *COVER:覆盖模式
   *CONTAIN:包含模式
   */
  const SHOW_TYPE = {
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
      this._board = document.createElement('canvas')
      this._ctx = this._board.getContext('2d')

      /*
       *裁减区域canvas
       */
      this._clipContainer = document.createElement('div')
      this._clipRect = document.createElement('canvas')
      this._clipCtx = this._clipRect.getContext('2d')

      /*
       *裁减框长宽配置
       */
      this._clipSize = {
        w: 100,
        h: 100,
        max: 0,
        min: 4 * buffer
      }

      /*
       *源图背景canvas起始位置
       */
      this._startPoint = {
        x: 0,
        y: 0
      }

      /*
       *移动背景canvas时的点击位置
       */
      this._downPoint = {
        x: 0,
        y: 0
      }

      /*
       *背景canvas的可移动x,y范围
       */
      this._posRange = {
        x: [],
        y: []
      }

      /*
       *背景canvas的坐标位置
       */
      this._clipRectPos = {
        x: 0,
        y: 0
      }

      /*
       *点击时clip的size
       */
      this._downClipSize = {
        w: 0,
        h: 0
      }

      /*
       *原图裁剪位置
       */
      this._srcPos = {
        x: 0,
        y: 0
      }

      /*
       *是否点击canvas,否则不触发move事件
       */
      this._isMouseDown = false

      /*
       *是否点击在resize框中
       */
      this._resizeTarget = null


      /*
       *缓存背景canvas
       *用于绘制裁减canvas
       */
      this._boardImage = null

      this._init()
    }

    async _init() {
      /*
       *初始化container
       */
      this._containerInit()

      /*
       *获取源图Image对象
       */
      const sourceImg = await this._readImage()

      /*
       *获取背景canvas的Image对象
       */
      this._boardImage = await this._drawIamge(sourceImg)

      /*
       *绘制蒙板
       */
      this._drawMask()

      /*
       *背景图canvas可移动
       */
      this._makeMovable()

      /*
       *添加背景图canvas
       */
      this.container.appendChild(this._board)

      /*
       *绘制裁剪canvas
       */
      this._drawClip()
      this._drawClipMask()

      /*
       *添加裁剪canvas
       *make movable
       */
      this._clipRectInit()


    }

    _containerInit() {

      this.container.innerHTML = ''
      this.container.style.cssText = `background-color:${maskBgColor}`
      this.container.classList.add('clipWrap')

    }


    _readImage() {

      return new Promise((resolve, reject) => {

        const sourceImg = new Image

        sourceImg.onload = () => {
          URL.revokeObjectURL(this.sourceFile)
          resolve(sourceImg)
        }

        sourceImg.src = URL.createObjectURL(this.sourceFile)

      })

    }

    _setPosRange() {

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const clipSize = this._clipSize

      const board = this._board
      const boardWidth = board.width
      const boardHeight = board.height

      const spaceX = (containerWidth - clipSize.w) / 2
      const spaceY = (containerHeight - clipSize.h) / 2
      this._posRange.x = [-(boardWidth + spaceX - containerWidth), spaceX]
      this._posRange.y = [-(boardHeight + spaceY - containerHeight), spaceY]

    }

    _drawIamge(sourceImg) {

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const boxRatio = container.clientWidth / container.clientHeight
      const imgRatio = sourceImg.width / sourceImg.height
      let boardWidth, boardHeight, x, y

      const clipSize = this._clipSize

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


      if (this.showType === SHOW_TYPE.CONTAIN) {
        if (imgRatio >= boxRatio) {
          strategyA()
          this._clipSize.w = this._clipSize.h = this._clipSize.max = boardHeight < containerWidth ? boardHeight : containerWidth
        } else {
          strategyB()
          this._clipSize.w = this._clipSize.h = this._clipSize.max = boardWidth < containerHeight ? boardWidth : containerHeight
        }

      } else if (this.showType === SHOW_TYPE.COVER) {
        if (imgRatio >= boxRatio) {
          strategyB()
          this._clipSize.max = boardHeight
        } else {
          strategyA()
          this._clipSize.max = boardWidth
        }
      }

      this._clipRectPos.x = x
      this._clipRectPos.y = y

      this._startPoint.x = x
      this._startPoint.y = y

      const board = this._board
      board.width = boardWidth
      board.height = boardHeight
      board.classList.add('imageBoard')
      board.style.cssText = `transform:translate3d(${x}px,${y}px,0)`

      this._setPosRange()
      this._ctx.drawImage(sourceImg, 0, 0, sourceImg.width, sourceImg.height, 0, 0, boardWidth, boardHeight)

      return new Promise((resolve, reject) => {
        const image = new Image
        image.onload = () => {
          resolve(image)
        }
        image.src = board.toDataURL('image/png')
      })

    }

    _drawMask() {

      const board = this._board
      const ctx = this._ctx

      ctx.fillStyle = maskBgColor
      ctx.fillRect(0, 0, board.width, board.height)

    }

    _makeMovable() {

      this._board.addEventListener('mousedown', this._down.bind(this), false)
      document.addEventListener('mousemove', this._move.bind(this), false)
      document.addEventListener('mouseup', this._up.bind(this), false)

      this._board.addEventListener('touchstart', this._down.bind(this), false)
      document.addEventListener('touchmove', this._move.bind(this), false)
      document.addEventListener('touchend', this._up.bind(this), false)

    }

    _down(e) {

      this._downPoint.x = e.pageX
      this._downPoint.y = e.pageY

      this._downClipSize.w = this._clipSize.w
      this._downClipSize.h = this._clipSize.h

      this._isMouseDown = true

      e.preventDefault()

    }

    _move(e) {

      const isMoveAble = this._isMouseDown && (e.target == this._board || e.target == this._clipRect) && (!this._resizeTarget)

      if (isMoveAble) {
        const posRange = this._posRange
        const clipRectPos = this._clipRectPos
        let x = e.pageX + this._startPoint.x - this._downPoint.x
        let y = e.pageY + this._startPoint.y - this._downPoint.y

        if (x < posRange.x[0]) x = posRange.x[0]
        if (x > posRange.x[1]) x = posRange.x[1]
        if (y < posRange.y[0]) y = posRange.y[0]
        if (y > posRange.y[1]) y = posRange.y[1]

        this._board.style.cssText = `transform:translate3d(${x}px,${y}px,0)`
        clipRectPos.x = x
        clipRectPos.y = y

        this._drawClip()
        this._drawClipMask()

        e.preventDefault()
      }

    }

    _up() {

      const matrixArr = getComputedStyle(this._board, null)['transform']
        .slice(7, -1).replace(/\s+/g, '').split(',')
        .map(function(item) {
          return parseFloat(item)
        })

      this._startPoint.x = matrixArr[4]
      this._startPoint.y = matrixArr[5]

      this._isMouseDown = false

      document.removeEventListener('mousemove', this._move)
      document.removeEventListener('mouseup', this._up)

      document.removeEventListener('touchmove', this._move)
      document.removeEventListener('touchend', this._up)

    }

    _drawClip() {

      const clipWidth = this._clipSize.w
      const clipHeight = this._clipSize.h

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const left = (containerWidth - clipWidth) / 2
      const top = (containerHeight - clipHeight) / 2

      const board = this._board
      const clipContainer = this._clipContainer

      const clipRect = this._clipRect
      const clipCtx = this._clipCtx

      this._srcPos.x = left - this._clipRectPos.x
      this._srcPos.y = top - this._clipRectPos.y

      clipCtx.clearRect(0, 0, containerWidth, containerHeight)

      clipRect.width = clipWidth
      clipRect.height = clipHeight


      clipCtx.drawImage(this._boardImage, this._srcPos.x, this._srcPos.y, clipWidth, clipHeight, 0, 0, clipWidth, clipHeight)

      clipContainer.style.cssText = `left:${left}px;top:${top}px;width:${clipWidth}px;height:${clipHeight}px;`
      clipContainer.classList.add('clipContainer')

      this._setPosRange()

    }

    _drawClipMask() {
      const clipCtx = this._clipCtx
      const clipWidth = this._clipRect.width
      const clipHeight = this._clipRect.height

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

    _clipRectInit() {

      const canvas = this._clipRect
      const clipContainer = this._clipContainer

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
      clipContainer.addEventListener('mousedown', this._down.bind(this), false)
      clipContainer.addEventListener('mousedown', this._bindClipEvent.bind(this), false)

      clipContainer.addEventListener('touchstart', this._down.bind(this), false)
      clipContainer.addEventListener('touchstart', this._bindClipEvent.bind(this), false)

      clipContainer.appendChild(canvas)
      this.container.appendChild(clipContainer)
    }

    _bindClipEvent(e) {

      this._resizeTarget = e.target.id

      document.addEventListener('mousemove', this._clipRectResize.bind(this), false)
      document.addEventListener('mouseup', this._clipRectUp.bind(this), false)

      document.addEventListener('touchmove', this._clipRectResize.bind(this), false)
      document.addEventListener('touchend', this._clipRectUp.bind(this), false)

      e.preventDefault()
    }

    _clipRectResize(e) {

      if (this._isMouseDown && this._resizeTarget) {

        const clipRect = this._clipRect

        const offX = e.offsetX
        const offY = e.offsetY
        const disX = (e.pageX - this._downPoint.x) * 2
        const disY = (e.pageY - this._downPoint.y) * 2

        const clipW = clipRect.width
        const clipH = clipRect.height

        const downClipSize = this._downClipSize
        const clipSize = this._clipSize

        if (this._resizeTarget == 'ltSPAN' || this._resizeTarget == 'lbSPAN') {
          clipSize.w = clipSize.h = downClipSize.w - disX
        } else {
          clipSize.w = clipSize.h = downClipSize.w + disX
        }

        if (clipSize.w < clipSize.min || clipSize.h < clipSize.min) {
          clipSize.w = clipSize.h = clipSize.min
        } else if (clipSize.w > clipSize.max || clipSize.h > clipSize.max) {
          clipSize.w = clipSize.h = clipSize.max
        }

        this._drawClip()
        this._drawClipMask()

        e.preventDefault()

      }


    }

    _clipRectUp() {

      this._resizeTarget = null

      document.removeEventListener('mousemove', this._clipRectResize)
      document.removeEventListener('mouseup', this._clipRectUp)

      document.removeEventListener('touchmove', this._clipRectResize)
      document.removeEventListener('touchend', this._clipRectUp)

    }

    async getClip() {

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const clipSize = this._clipSize
      const clipWidth = clipSize.w
      const clipHeight = clipSize.h

      canvas.width = clipWidth
      canvas.height = clipHeight

      ctx.drawImage(this._boardImage, this._srcPos.x, this._srcPos.y, clipWidth, clipHeight, 0, 0, clipWidth, clipHeight)

      this.clip64 = canvas.toDataURL(this.outPutOpt.type, this.outPutOpt.quality)

      const binary = await this._outPutBinary()
      this.clipBlob = binary.blob
      this.clipArrayBuffer = binary.arrayBuffer

      return Promise.resolve()

    }

    _outPutBinary() {

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
      a.download = 'clip_image'
      a.href = this.clip64
      a.click()
    }

    reset() {
      this._clipSize = {
        w: 100,
        h: 100,
        max: 0,
        min: 2 * buffer
      }
      this._init()
    }

  }

  function clip(container, sourceFile, showType) {

    return new Clip(container, sourceFile, showType)

  }

  return clip

}))
