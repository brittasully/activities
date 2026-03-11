(function () {
  'use strict';

  const paletteColors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#000000', '#ffffff'];

  function hexToRgba(hex) {
    const value = hex.replace('#', '');
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
      255,
    ];
  }

  function colorsMatch(data, i, target) {
    return data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
  }

  function floodFill(ctx, x, y, fillColor) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;

    const start = (Math.floor(y) * width + Math.floor(x)) * 4;
    const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];

    if (target[0] === fillColor[0] && target[1] === fillColor[1] && target[2] === fillColor[2] && target[3] === fillColor[3]) {
      return;
    }

    if (target[0] < 20 && target[1] < 20 && target[2] < 20) {
      return;
    }

    const queue = [[Math.floor(x), Math.floor(y)]];
    while (queue.length) {
      const point = queue.pop();
      const px = point[0];
      const py = point[1];

      if (px < 0 || py < 0 || px >= width || py >= height) {
        continue;
      }

      const idx = (py * width + px) * 4;
      if (!colorsMatch(data, idx, target)) {
        continue;
      }

      data[idx] = fillColor[0];
      data[idx + 1] = fillColor[1];
      data[idx + 2] = fillColor[2];
      data[idx + 3] = 255;

      queue.push([px + 1, py]);
      queue.push([px - 1, py]);
      queue.push([px, py + 1]);
      queue.push([px, py - 1]);
    }

    ctx.putImageData(image, 0, 0);
  }

  function initApp(root) {
    const canvas = root.querySelector('.dcp-canvas');
    const palette = root.querySelector('.dcp-palette');
    const message = root.querySelector('.dcp-message');
    const brushSizeInput = root.querySelector('.dcp-brush-size');
    const pageId = Number(root.dataset.pageId || 0);

    if (!canvas || !palette || !pageId) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');

    const state = {
      tool: 'brush',
      color: paletteColors[0],
      drawing: false,
      brushSize: 8,
    };

    function buildPalette() {
      palette.innerHTML = '';
      paletteColors.forEach((color, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dcp-color-swatch';
        button.style.background = color;
        button.setAttribute('aria-label', 'Select color ' + color);
        button.setAttribute('aria-checked', index === 0 ? 'true' : 'false');
        button.addEventListener('click', function () {
          state.color = color;
          palette.querySelectorAll('.dcp-color-swatch').forEach((swatch) => swatch.setAttribute('aria-checked', 'false'));
          button.setAttribute('aria-checked', 'true');
        });
        palette.appendChild(button);
      });
    }

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      };
    }

    function drawStart(event) {
      if (state.tool === 'bucket') {
        const point = pointerPosition(event);
        floodFill(ctx, point.x, point.y, hexToRgba(state.color));
        return;
      }

      state.drawing = true;
      const point = pointerPosition(event);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }

    function drawMove(event) {
      if (!state.drawing) {
        return;
      }

      const point = pointerPosition(event);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = state.brushSize;
      ctx.strokeStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    function drawEnd() {
      state.drawing = false;
      ctx.closePath();
    }

    root.querySelectorAll('.dcp-tool').forEach((toolButton) => {
      toolButton.addEventListener('click', function () {
        state.tool = toolButton.dataset.tool || 'brush';
      });
    });

    brushSizeInput.addEventListener('input', function () {
      state.brushSize = Number(brushSizeInput.value) || 8;
    });

    root.querySelector('.dcp-reset').addEventListener('click', function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0);
    });

    root.querySelector('.dcp-download').addEventListener('click', function () {
      const link = document.createElement('a');
      link.download = 'digital-coloring-page-' + pageId + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    canvas.addEventListener('pointerdown', drawStart);
    canvas.addEventListener('pointermove', drawMove);
    canvas.addEventListener('pointerup', drawEnd);
    canvas.addEventListener('pointerleave', drawEnd);

    buildPalette();

    const requestUrl = dcpFront.ajaxUrl + '?action=dcp_get_coloring_page&nonce=' + encodeURIComponent(dcpFront.nonce) + '&post_id=' + pageId;
    fetch(requestUrl, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((payload) => {
        if (!payload || !payload.success) {
          throw new Error(payload && payload.data && payload.data.message ? payload.data.message : 'Unable to load image');
        }

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = function () {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
          const width = image.width * ratio;
          const height = image.height * ratio;
          const x = (canvas.width - width) / 2;
          const y = (canvas.height - height) / 2;
          ctx.drawImage(image, x, y, width, height);
          offCtx.drawImage(canvas, 0, 0);
          message.textContent = payload.data.title;
        };
        image.src = payload.data.outlineUrl;
      })
      .catch((error) => {
        message.textContent = error.message;
      });
  }

  document.querySelectorAll('.dcp-coloring-app').forEach(initApp);
})();
