(function(global) {
  var bind, isMobile, _self, CanvasClip;

  bind = (function() {
    if (window.addEventListener) {
      return function(ele, type, handler) {
        ele.addEventListener(type, handler, false);
      }
    } else {
      return function(ele, type, handler) {
        ele.attatchEvent('on' + type, handler)
      }
    }
  })();

  isMobile = (function() {
    var reg = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return reg.test(navigator.userAgent)
  })();

  CanvasClip = function(setting) {
    /*canvas preview container*/
    this.previewContainer = setting.previewContainer;
    /*preview canvas width, default 400*/
    this.canvasWidth = setting.canvasWidth || 400;
    /*image to be precessed*/
    this.source = setting.source;
    /*cliped-image compress quality*/
    this.quality = setting.quality || 0.86;
    /*clip-box info*/
    this.cutRect = {};
    /*cliped-image base64*/
    this.ret64 = '';
    this.retBinary = null;
    /*clip line width*/
    this.clipLineWidth = 4;
    /*preview canvas dom*/
    this.canvas = this.previewContainer.querySelector('canvas') || document.createElement('canvas');
    /*preview canvas context*/
    this.context = this.canvas.getContext('2d');
    /*img object to be drawed on canvas*/
    this.img = new Image;
    /*canvasPosition*/
    this.canvasPosition = {};


    /*flag for checking mousedown,mousemove,mouseup-clip action*/
    this._isMouseDown = false;
    this._isMouseMoved = false;
    this._isCliped = false;
    this._isRectChanged = false;


    _self = this;
    /*init: drawImage && makeClip*/
    this.init();
  }

  CanvasClip.prototype.init = function() {
    var reader = new FileReader;

    reader.onload = function() {
      _self.img.src = this.result;

      _self.img.onload = function() {
        _self.canvas.width = _self.canvasWidth;
        _self.canvas.height = _self.img.height * _self.canvas.width / _self.img.width;
        drawMaskImage();
        makeClip();
        if (_self.previewContainer.hasChildNodes()) {
          _self.previewContainer.removeChild(_self.canvas);
        }
        _self.previewContainer.appendChild(_self.canvas);
      }

    };

    reader.readAsDataURL(_self.source)
  }

  CanvasClip.prototype.clip = function() {
    var offCanvas = document.createElement('canvas'),
      offContext = offCanvas.getContext('2d'),
      w = _self.cutRect.width,
      h = _self.cutRect.height;

    offCanvas.width = w;
    offCanvas.height = h;
    offContext.drawImage(_self.canvas, _self.cutRect.x, _self.cutRect.y, w, h, 0, 0, w, h);

    /*transform cliped-image to base64*/
    _self.ret64 = offCanvas.toDataURL('image/jpeg', _self.quality);
    /*transform base64 to blob*/
    dataURLtoBlob();

    drawMaskImage();
    _self._isCliped = false;
  }

  function dataURLtoBlob() {
    var binaryString = atob(_self.ret64.split(',')[1]),
      arrayBuffer = new ArrayBuffer(binaryString.length),
      unitArray = new Uint8Array(arrayBuffer),
      mime = _self.ret64.split(',')[0].match(/:(.*?);/)[1];

    for (var i = 0, j = binaryString.length; i < j; i++) {
      unitArray[i] = binaryString.charCodeAt(i);
    }

    _self.retBinary = new Blob(unitArray, {
      type: mime
    });
  }


  function drawMaskImage() {
    _self.context.drawImage(_self.img, 0, 0, _self.canvas.width, _self.canvas.height);
    // draw mask
    _self.context.save();
    _self.context.fillStyle = 'rgba(0,0,0,.4)';
    _self.context.beginPath();
    _self.context.fillRect(0, 0, _self.canvas.width, _self.canvas.height);
    _self.context.restore();

    _self.canvasPosition = _self.canvas.getBoundingClientRect();

  }

  function makeClip() {

    var cutRect = {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
    var clipedDownPoint = {
      x: 0,
      y: 0,
      originalRectX: 0,
      originalRectY: 0,
    };

    if (isMobile) {
      bind(_self.canvas, 'touchstart', touchDownHandler);
      bind(document, 'touchmove', touchMoveHandler);
      bind(document, 'touchend', touchUpHandler);
    } else {
      bind(_self.canvas, 'mousedown', touchDownHandler);
      bind(document, 'mousemove', touchMoveHandler);
      bind(document, 'mouseup', touchUpHandler);
    }
    /*check if mousedown in cliped-box*/
    function isInRect(x, y) {
      var beginX = cutRect.x,
        endX = cutRect.x + cutRect.width,
        beginY = cutRect.y,
        endY = cutRect.y + cutRect.height;
      return (beginX < x) && (x < endX) && (beginY < y) && (y < endY);
    }


    function drawClipBox(e) {
      if (_self._isRectChanged) { //change clip-box size when clip not exists
        var p = getCordinate(e);
        cutRect.width = p.x - cutRect.x;
        cutRect.height = p.y - cutRect.y;
      }
      _self.context.save();
      _self.context.strokeStyle = 'red';
      _self.context.setLineDash([4, 4]);
      _self.context.lineDashOffset = 10;
      _self.context.lineWidth = _self.clipLineWidth;
      _self.context.beginPath();
      _self.context.rect(cutRect.x, cutRect.y, cutRect.width, cutRect.height);
      _self.context.clip();
      _self.context.drawImage(_self.img, 0, 0, _self.canvas.width, _self.canvas.height);
      _self.context.stroke();
      _self.context.restore();
    }

    var getCordinate = (function() {
      if (isMobile) {
        return function(e) {
          return {
            x: e.changedTouches[0].clientX - _self.canvasPosition.left,
            y: e.changedTouches[0].clientY - _self.canvasPosition.top,
          }
        }
      } else {
        return function(e) {
          return {
            x: e.offsetX,
            y: e.offsetY,
          }
        }
      }
    })();

    function touchDownHandler(e) {
      e.preventDefault();
      var p = getCordinate(e);
      var x = p.x;
      var y = p.y;
      if (!_self._isCliped) { //to clip
        cutRect.x = x;
        cutRect.y = y;
        _self._isMouseDown = true;
      } else {
        if (isInRect(x, y)) { //to move cliprect
          clipedDownPoint.x = x;
          clipedDownPoint.y = y;
          clipedDownPoint.originalRectX = cutRect.x; // store the original clip info(x)
          clipedDownPoint.originalRectY = cutRect.y; // store the original clip info(y)
          _self._isMouseDown = true;
        } else { //redraw canvas
          drawMaskImage();
          _self._isCliped = false;
        }
      }
    }

    function redrawClipedCanvas(e) {
      /*reset canvas*/
      _self.context.clearRect(0, 0, _self.canvas.width, _self.canvas.height);
      drawMaskImage();

      /*draw clipBox*/
      drawClipBox(e);
    }

    function touchMoveHandler(e) {
      e.preventDefault();
      var target = isMobile ? document.elementFromPoint(e.touches[0].pageX, e.touches[0].pageY) : e.target; // mobile touchmove target not change
      if (target === _self.canvas) {
        if (_self._isMouseDown) {
          _self._isMouseMoved = true;
          if (!_self._isCliped) {
            _self._isRectChanged = true;
            redrawClipedCanvas(e);
          } else {
            _self._isRectChanged = false;
            var p = getCordinate(e);
            /*draw clipBox*/
            cutRect.x = clipedDownPoint.originalRectX + p.x - clipedDownPoint.x;
            cutRect.y = clipedDownPoint.originalRectY + p.y - clipedDownPoint.y;

            if (cutRect.x < 0) {
              cutRect.x = 0
            }
            if (cutRect.x > _self.canvas.width - cutRect.width) {
              cutRect.x = _self.canvas.width - cutRect.width;
            }
            if (cutRect.y < 0) {
              cutRect.y = 0
            }
            if (cutRect.y > _self.canvas.height - cutRect.height) {
              cutRect.y = _self.canvas.height - cutRect.height;
            }
            redrawClipedCanvas(e);
          }
        }
      }
    }

    function touchUpHandler(e) {
      _self._isMouseDown = false;
      if (_self._isMouseMoved) {
        _self._isMouseMoved = false;
        _self._isCliped = true;
        /*process width and height less than 0*/
        cutRect = {
          x: cutRect.width < 0 ? (cutRect.x + _self.clipLineWidth / 2 + cutRect.width) : (cutRect.x + _self.clipLineWidth / 2),
          y: cutRect.height < 0 ? (cutRect.y + _self.clipLineWidth / 2 + cutRect.height) : (cutRect.y + _self.clipLineWidth / 2),
          width: Math.abs(cutRect.width) - _self.clipLineWidth,
          height: Math.abs(cutRect.height) - _self.clipLineWidth,
        };
        _self.cutRect = cutRect;
      }
    }
  }

  // support amd commonjs and global
  if (typeof define === 'function' && define.amd) {
    define(function() {
      return CanvasClip;
    });
  } else if (typeof module != 'undefined' && module.exports) {
    module.exports = CanvasClip;
  } else {
    global.CanvasClip = CanvasClip;
  }

})(window)
