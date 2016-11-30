(function() {
  var bind, _self;

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
  })()

  window.CanvasClip = function(setting) {
    /*canvas preview container*/
    this.previewContainer = setting.previewContainer;
    /*preview canvas width, default 400*/
    this.canvasWidth = setting.canvasWidth || 400;
    /*image to be precessed*/
    this.source = setting.source;
    /*cliped-image compress quality*/
    this.quality = setting.quality || 0.92;
    /*clip-box info*/
    this.cutRect = {};
    /*cliped-image base64*/
    this.ret64 = '';
    /*clip line width*/
    this.clipLineWidth = 4;
    /*preview canvas dom*/
    this.canvas = this.previewContainer.querySelector('canvas') || document.createElement('canvas');
    /*preview canvas context*/
    this.context = this.canvas.getContext('2d');
    /*img object to be drawed on canvas*/
    this.img = new Image;

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
  }

  function dataURLtoBlob() {
    var binaryString = atob(_self.ret64.split(',')[1]),
      arrayBuffer = new ArrayBuffer(binaryString.length),
      unitArray = new Uint8Array(arrayBuffer),
      mime = _self.ret64.split(',')[0].match(/:(.*?);/)[1];

    for (var i = 0, j = binaryString.length; i < j; i++) {
      unitArray[i] = binaryString.charCodeAt(i);
    }

    var data = unitArray;

    _self.retBinary = new Blob(data, {
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

  }

  function makeClip() {
    var isMouseDown = false;
    var cutRect = {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };

    bind(_self.canvas, 'mousedown', touchDownHandler);
    bind(_self.canvas, 'touchstart', touchDownHandler);
    bind(document, 'mousemove', touchMoveHandler);
    bind(document, 'touchmove', touchMoveHandler);
    bind(document, 'mouseup', touchUpHandler);
    bind(document, 'touchend', touchUpHandler);

    function touchDownHandler(e) {
      e.preventDefault();
      drawMaskImage();
      cutRect.x = e.offsetX;
      cutRect.y = e.offsetY;
      isMouseDown = true;
    }

    function touchMoveHandler(e) {
      e.preventDefault();

      if (isMouseDown) {
        /*reset canvas*/
        _self.context.clearRect(0, 0, _self.canvas.width, _self.canvas.height);
        drawMaskImage();

        /*draw clipBox*/
        cutRect.width = e.offsetX - cutRect.x;
        cutRect.height = e.offsetY - cutRect.y;
        _self.context.save();
        _self.context.strokeStyle = '#fff';
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
    }

    function touchUpHandler(e) {
      e.preventDefault();
      isMouseDown = false;
      _self.cutRect = {
        x: cutRect.x + _self.clipLineWidth / 2,
        y: cutRect.y + _self.clipLineWidth / 2,
        width: cutRect.width - _self.clipLineWidth,
        height: cutRect.height - _self.clipLineWidth,
      };
    }
  }
})()
