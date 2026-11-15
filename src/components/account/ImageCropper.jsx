'use client';

/* global ResizeObserver */
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
import { framedImageStyle } from './crop-image';
import './image-cropper.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
/** How far one arrow key press slides the picture, in panel pixels. */
const KEYBOARD_STEP = 10;
/** Room between the frame and the edge of the picture, so the dimmed part shows all around. */
const FRAME_INSET = 22;
/** How long the thirds stay up after the last drag or zoom, in milliseconds. */
const GRID_LINGER = 300;
/** Room enough to set the two buttons beside each other, and room enough for a side column. */
const ROW_WIDTH = 420;
const SIDE_WIDTH = 620;

let sequence = 0;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export default class ImageCropper extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      crop: { x: 0, y: 0 },
      zoom: MIN_ZOOM,
      area: null,
      /** The stage as it is on screen right now, which decides how big the frame is. */
      stage: null,
      /** The room the panel was given, which decides how the panel lays itself out. */
      room: 0,
      /** True while a finger, the mouse, the wheel or the slider is moving the picture. */
      busyFraming: false,
    };
    this.shellRef = React.createRef();
    this.stageRef = React.createRef();
    this.measure = this.measure.bind(this);
    // Rendered only after a file is picked, so there is no server markup to match.
    this.hintId = 'dc-crop-hint-' + ++sequence;
  }
  componentDidMount() {
    /* Measured here rather than from a ResizeObserver callback so the frame is already inset
       on the first paint: React flushes this before the browser draws. */
    this.measure();
    if (typeof ResizeObserver === 'function') {
      this.observer = new ResizeObserver(this.measure);
      if (this.shellRef.current) this.observer.observe(this.shellRef.current);
      if (this.stageRef.current) this.observer.observe(this.stageRef.current);
    }
  }
  componentWillUnmount() {
    if (this.observer) this.observer.disconnect();
    clearTimeout(this.gridTimer);
  }
  /**
   * The panel reads its own size rather than the window's, because it sits in a card that is
   * one column on a phone and one of two on a laptop. A CSS container query would say the same
   * thing, but Chromium leaves a size container's contents unlaid out after some updates, which
   * collapsed the whole panel, so the two sizes that matter are measured here instead.
   *
   * A stage with no size is never a real state, only a frame caught mid layout, so the last
   * size that meant something stands until a real one arrives.
   */
  measure() {
    const stage = this.stageRef.current?.getBoundingClientRect();
    const room = this.shellRef.current?.getBoundingClientRect().width ?? 0;
    const patch = {};
    if (Math.abs(room - this.state.room) > 0.5) patch.room = room;
    if (
      stage &&
      stage.width >= 1 &&
      stage.height >= 1 &&
      (!this.state.stage ||
        Math.abs(this.state.stage.width - stage.width) > 0.5 ||
        Math.abs(this.state.stage.height - stage.height) > 0.5)
    )
      patch.stage = { width: stage.width, height: stage.height };
    if (patch.room !== undefined || patch.stage) this.setState(patch);
  }
  /** The picture's own shape, within the range the stage is willing to take. */
  mediaRatio() {
    const { naturalWidth, naturalHeight, aspect = 1 } = this.props;
    return naturalWidth > 0 && naturalHeight > 0
      ? naturalWidth / naturalHeight
      : aspect;
  }
  /**
   * The frame, in stage pixels. react-easy-crop would otherwise run it to the edges; sizing it
   * here keeps a margin of dimmed picture on all four sides. The picture is drawn to fit the
   * stage without being blown up, so the margin is measured from the picture, not the stage.
   */
  cropSize() {
    const { aspect = 1, naturalWidth = 0 } = this.props;
    const stage = this.state.stage;
    if (!stage?.width || !stage.height) return undefined;
    const ratio = this.mediaRatio();
    const shownWidth = Math.min(
      stage.width,
      stage.height * ratio,
      naturalWidth > 0 ? naturalWidth : stage.width,
    );
    const space = {
      width: Math.max(48, shownWidth - FRAME_INSET * 2),
      height: Math.max(48, shownWidth / ratio - FRAME_INSET * 2),
    };
    const width = Math.min(space.width, space.height * aspect);
    return { width: Math.round(width), height: Math.round(width / aspect) };
  }
  /* A slider move has no end of its own, so it opens and closes the same window a drag does. */
  zoomTo(zoom) {
    this.setState({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
    this.framing(true);
    this.framing(false);
  }
  /** Raises the thirds while the picture is being moved, and drops them a moment after. */
  framing(on) {
    clearTimeout(this.gridTimer);
    if (on) return this.setState({ busyFraming: true });
    this.gridTimer = setTimeout(
      () => this.setState({ busyFraming: false }),
      GRID_LINGER,
    );
  }
  /** Hands the frame on: to the previews here, and to whatever else shows it on the page. */
  report(area) {
    this.setState({ area });
    if (this.props.onPreview) this.props.onPreview(area);
  }
  /** The result at the sizes it is printed at: the account menu and the teammate cards. */
  renderPreviews(previews) {
    const { src, naturalWidth, naturalHeight } = this.props;
    const style = framedImageStyle(this.state.area, {
      naturalWidth,
      naturalHeight,
    });
    return (
      <div className="dc-crop-previews">
        {previews.map((preview) => (
          <div className="dc-crop-preview" key={preview.label}>
            <span
              className="dc-crop-preview-frame"
              aria-hidden="true"
              style={{
                width: preview.size + 'px',
                height: preview.size + 'px',
              }}
            >
              {style ? <img src={src} alt="" style={style} /> : null}
            </span>
            <span className="dc-crop-preview-label">{preview.label}</span>
          </div>
        ))}
      </div>
    );
  }
  render() {
    const {
      src,
      shape = 'rect',
      aspect = 1,
      minRatio = 1,
      maxRatio = 1,
      maxStageWidth = 560,
      maxStageHeight = 340,
      label = 'Crop',
      previews,
      saveLabel = 'Save',
      busyLabel = 'Saving…',
      cancelLabel = 'Cancel',
      busy = false,
      onSave,
      onCancel,
    } = this.props;
    const { crop, zoom, area, busyFraming, room } = this.state;
    /* The stage takes the picture's own shape, within reason, so the picture fills it and the
       frame sits on the picture rather than on empty bands beside it. The width cap is the
       height cap in disguise: it keeps that shape on a wide screen. */
    const stageRatio = clamp(this.mediaRatio(), minRatio, maxRatio);
    const stageWidth = Math.round(
      Math.min(maxStageWidth, maxStageHeight * stageRatio),
    );
    return (
      <div
        className="dc-crop-shell"
        ref={this.shellRef}
        style={{ '--dc-stage': stageWidth + 'px' }}
      >
        <div
          className="dc-crop"
          data-shape={shape}
          data-framing={busyFraming ? 'true' : 'false'}
          data-row={room >= ROW_WIDTH ? 'true' : 'false'}
          data-side={room >= SIDE_WIDTH ? 'true' : 'false'}
        >
          <p className="dc-crop-hint" id={this.hintId}>
            <span className="dc-crop-hint-fine">
              Drag to move, scroll or use the slider to zoom.
            </span>
            <span className="dc-crop-hint-coarse">
              Drag to move, pinch to zoom.
            </span>
          </p>
          <div
            className="dc-crop-stage"
            ref={this.stageRef}
            style={{ aspectRatio: String(stageRatio) }}
          >
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={shape === 'round' ? 'round' : 'rect'}
              cropSize={this.cropSize()}
              showGrid
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              keyboardStep={KEYBOARD_STEP}
              objectFit="contain"
              restrictPosition
              zoomWithScroll
              onCropChange={(next) => this.setState({ crop: next })}
              onZoomChange={(next) =>
                this.setState({ zoom: clamp(next, MIN_ZOOM, MAX_ZOOM) })
              }
              onCropAreaChange={(_, pixels) => this.report(pixels)}
              onInteractionStart={() => this.framing(true)}
              onInteractionEnd={() => this.framing(false)}
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
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
              >
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
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
              >
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
          <div className="dc-crop-side">
            {previews?.length ? this.renderPreviews(previews) : null}
            <div className="dc-crop-actions">
              <button
                type="button"
                className="dc-crop-button dc-crop-primary"
                disabled={busy || !area}
                onClick={() => area && onSave(area)}
              >
                {busy ? busyLabel : saveLabel}
              </button>
              <button
                type="button"
                className="dc-crop-button dc-crop-ghost"
                disabled={busy}
                onClick={() => onCancel()}
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
