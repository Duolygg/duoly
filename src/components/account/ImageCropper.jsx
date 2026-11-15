'use client';

/*
 * The crop panel behind both pictures a teammate uploads: the round profile picture and the
 * wide profile header. react-easy-crop (MIT) does the dragging, the pinching and the wheel;
 * everything visible here is Duoly's own, from image-cropper.css.
 *
 * The frame is reported back as `croppedAreaPixels`, a rectangle of the picked file's real
 * pixels, which crop-image.ts paints at the size the endpoint stores. This panel never encodes
 * anything itself, so the two uploads keep their own sizes and limits.
 */
import React from 'react';
import Cropper from 'react-easy-crop';
import './image-cropper.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
/** How far one arrow key press slides the picture, in panel pixels. */
const KEYBOARD_STEP = 10;

let sequence = 0;
const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Round, at the two sizes an uploaded picture is actually printed at. */
const PREVIEWS = [32, 56];

export default class ImageCropper extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      crop: { x: 0, y: 0 },
      zoom: MIN_ZOOM,
      area: null,
      media: null,
    };
    // Rendered only after a file is picked, so there is no server markup to match.
    this.hintId = 'dc-crop-hint-' + ++sequence;
  }
  zoomTo(zoom) {
    this.setState({ zoom: clampZoom(zoom) });
  }
  /** The live round preview: the same rectangle, drawn by offsetting the picture in a circle. */
  renderPreview() {
    const { area, media } = this.state;
    return (
      <div className="dc-crop-previews">
        <div className="dc-crop-preview-row" aria-hidden="true">
          {PREVIEWS.map((size) => {
            const scale = area && area.width ? size / area.width : 0;
            return (
              <span
                className="dc-crop-preview-frame"
                key={size}
                style={{ width: size + 'px', height: size + 'px' }}
              >
                {scale && media ? (
                  <img
                    src={this.props.src}
                    alt=""
                    style={{
                      width: media.naturalWidth * scale + 'px',
                      height: media.naturalHeight * scale + 'px',
                      marginLeft: -area.x * scale + 'px',
                      marginTop: -area.y * scale + 'px',
                    }}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
        <span className="dc-crop-preview-label">
          How it looks in the navbar and on your cards
        </span>
      </div>
    );
  }
  render() {
    const {
      src,
      shape = 'rect',
      aspect = 1,
      ratio = 1,
      stageMin = 0.8,
      stageMax = 1.4,
      stageHeight = 340,
      label = 'Crop',
      hint,
      saveLabel = 'Save',
      busyLabel = 'Saving…',
      cancelLabel = 'Choose another',
      busy = false,
      accent = 'lavender',
      preview = false,
      grid = false,
      onSave,
      onCancel,
    } = this.props;
    const { crop, zoom, area } = this.state;
    const stageRatio = Math.min(
      stageMax,
      Math.max(stageMin, ratio > 0 ? ratio : 1),
    );
    return (
      <div className="dc-crop" data-shape={shape} data-accent={accent}>
        {/* The stage takes the picture's own shape, within reason, so the whole picture fills
            it and the frame sits on the picture rather than on empty bands beside it. The
            width cap is the height cap in disguise: it keeps that shape on a wide screen. */}
        <div
          className="dc-crop-stage"
          style={{
            aspectRatio: stageRatio,
            maxWidth: Math.round(stageRatio * stageHeight) + 'px',
          }}
        >
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={shape === 'round' ? 'round' : 'rect'}
            showGrid={grid}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            keyboardStep={KEYBOARD_STEP}
            objectFit="contain"
            restrictPosition
            zoomWithScroll
            onCropChange={(next) => this.setState({ crop: next })}
            onZoomChange={(next) => this.setState({ zoom: clampZoom(next) })}
            onCropAreaChange={(_, pixels) => this.setState({ area: pixels })}
            onMediaLoaded={(media) => this.setState({ media })}
            classes={{
              containerClassName: 'dc-crop-canvas',
              mediaClassName: 'dc-crop-media',
              cropAreaClassName: 'dc-crop-frame',
            }}
            cropperProps={{
              role: 'img',
              'aria-label': label,
              'aria-describedby': this.hintId,
            }}
          />
        </div>
        <div className="dc-crop-zoom">
          <button
            type="button"
            className="dc-crop-step"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => this.zoomTo(zoom - ZOOM_STEP)}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
              <rect
                x="5"
                y="11"
                width="14"
                height="2"
                rx="1"
                fill="currentColor"
              />
            </svg>
          </button>
          <input
            className="dc-crop-range"
            type="range"
            style={{
              '--dc-fill':
                ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100 + '%',
            }}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.02"
            value={zoom}
            aria-label="Zoom"
            aria-valuetext={Math.round(zoom * 100) + ' percent'}
            onChange={(e) => this.zoomTo(Number(e.target.value))}
          />
          <button
            type="button"
            className="dc-crop-step"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => this.zoomTo(zoom + ZOOM_STEP)}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
              <rect
                x="5"
                y="11"
                width="14"
                height="2"
                rx="1"
                fill="currentColor"
              />
              <rect
                x="11"
                y="5"
                width="2"
                height="14"
                rx="1"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        {preview ? this.renderPreview() : null}
        <p className="dc-crop-hint" id={this.hintId}>
          {hint}
        </p>
        <div className="dc-crop-actions">
          <button
            type="button"
            className="dc-crop-button dc-crop-save"
            disabled={busy || !area}
            onClick={() => area && onSave(area)}
          >
            {busy ? busyLabel : saveLabel}
          </button>
          <button
            type="button"
            className="dc-crop-button"
            disabled={busy}
            onClick={() => onCancel()}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    );
  }
}
