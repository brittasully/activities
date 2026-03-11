(function () {
  'use strict';

  const selectButton = document.getElementById('dcp-select-image');
  if (!selectButton || typeof wp === 'undefined' || !wp.media) {
    return;
  }

  const originalCanvas = document.getElementById('dcp-original-canvas');
  const outlineCanvas = document.getElementById('dcp-outline-canvas');
  const thresholdInput = document.getElementById('dcp-threshold');
  const generateButton = document.getElementById('dcp-generate-outline');
  const saveButton = document.getElementById('dcp-save-page');
  const titleInput = document.getElementById('dcp-page-title');
  const message = document.getElementById('dcp-save-message');

  const state = {
    originalId: 0,
    outlineReady: false,
    mediaFrame: null,
  };

  const originalCtx = originalCanvas.getContext('2d');
  const outlineCtx = outlineCanvas.getContext('2d');

  function drawImageToCanvas(image, context, canvas) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
    const targetWidth = image.width * ratio;
    const targetHeight = image.height * ratio;
    const x = (canvas.width - targetWidth) / 2;
    const y = (canvas.height - targetHeight) / 2;
    context.drawImage(image, x, y, targetWidth, targetHeight);
  }

  function createOutline(threshold) {
    const src = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const output = outlineCtx.createImageData(src.width, src.height);

    const gray = new Uint8ClampedArray(src.width * src.height);
    for (let i = 0; i < src.data.length; i += 4) {
      const idx = i / 4;
      gray[idx] = 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2];
    }

    for (let y = 1; y < src.height - 1; y += 1) {
      for (let x = 1; x < src.width - 1; x += 1) {
        const idx = y * src.width + x;
        const gx =
          -gray[idx - src.width - 1] - 2 * gray[idx - 1] - gray[idx + src.width - 1] +
          gray[idx - src.width + 1] + 2 * gray[idx + 1] + gray[idx + src.width + 1];
        const gy =
          -gray[idx - src.width - 1] - 2 * gray[idx - src.width] - gray[idx - src.width + 1] +
          gray[idx + src.width - 1] + 2 * gray[idx + src.width] + gray[idx + src.width + 1];

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edge = magnitude > threshold ? 0 : 255;
        const outIdx = idx * 4;
        output.data[outIdx] = edge;
        output.data[outIdx + 1] = edge;
        output.data[outIdx + 2] = edge;
        output.data[outIdx + 3] = 255;
      }
    }

    outlineCtx.putImageData(output, 0, 0);
    state.outlineReady = true;
  }

  selectButton.addEventListener('click', function () {
    if (!state.mediaFrame) {
      state.mediaFrame = wp.media({
        title: 'Select image for coloring page',
        button: { text: 'Use this image' },
        library: { type: 'image' },
        multiple: false,
      });

      state.mediaFrame.on('select', function () {
        const attachment = state.mediaFrame.state().get('selection').first().toJSON();
        state.originalId = Number(attachment.id) || 0;

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = function () {
          drawImageToCanvas(image, originalCtx, originalCanvas);
          outlineCtx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);
          state.outlineReady = false;
          message.textContent = '';
        };
        image.src = attachment.url;
      });
    }

    state.mediaFrame.open();
  });

  generateButton.addEventListener('click', function () {
    if (!state.originalId) {
      message.textContent = dcpAdmin.messages.missingImage;
      return;
    }

    const threshold = Number(thresholdInput.value) || 140;
    createOutline(Math.max(1, Math.min(255, threshold)));
    message.textContent = 'Outline generated. Save when ready.';
  });

  saveButton.addEventListener('click', function () {
    const title = (titleInput.value || '').trim();
    if (!state.originalId) {
      message.textContent = dcpAdmin.messages.missingImage;
      return;
    }

    if (!state.outlineReady) {
      message.textContent = dcpAdmin.messages.missingOutline;
      return;
    }

    if (!title) {
      message.textContent = dcpAdmin.messages.missingTitle;
      return;
    }

    const body = new URLSearchParams({
      action: 'dcp_create_coloring_page',
      nonce: dcpAdmin.nonce,
      title: title,
      original_id: String(state.originalId),
      outline_data: outlineCanvas.toDataURL('image/png'),
    });

    saveButton.disabled = true;
    message.textContent = 'Saving...';

    fetch(dcpAdmin.ajaxUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: body,
    })
      .then((res) => res.json())
      .then((payload) => {
        if (!payload || !payload.success) {
          throw new Error(payload && payload.data && payload.data.message ? payload.data.message : 'Save failed');
        }

        message.innerHTML = 'Saved! Shortcode: <code>' + payload.data.shortcode + '</code>';
      })
      .catch((error) => {
        message.textContent = error.message;
      })
      .finally(() => {
        saveButton.disabled = false;
      });
  });
})();
