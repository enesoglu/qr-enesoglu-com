import { useRef, useState } from 'react';
import { renderShapePreview } from '../core/render';
import { ColorInput, RadioGroup, ShapePicker } from '../components/Controls';
import type { Fill, LogoOptions, QrDesign } from '../core/types';
import { errorMessage, useAppStore } from './store';

export function ColorsPanel() {
  const { design, setDesign } = useAppStore();
  const fill = design.body.fill;
  const first = fill.type === 'solid' ? fill.color : fill.stops[0].color;
  const second = fill.type === 'solid' ? '#555555' : fill.stops[1].color;
  function setFill(next: Fill) {
    setDesign({ ...design, body: { ...design.body, fill: next } });
  }
  function changeStop(index: 0 | 1, color: string) {
    if (fill.type === 'solid') setFill({ type: 'solid', color });
    else
      setFill({
        ...fill,
        stops: [
          { offset: 0, color: index === 0 ? color : first },
          { offset: 1, color: index === 1 ? color : second },
        ],
      });
  }
  return (
    <section className="panel">
      <h2>Colors</h2>
      <RadioGroup
        label="Fill type"
        value={fill.type}
        options={['solid', 'linear', 'radial']}
        onChange={(type) =>
          setFill(
            type === 'solid'
              ? { type, color: first }
              : type === 'linear'
                ? {
                    type,
                    rotation: 0,
                    stops: [
                      { offset: 0, color: first },
                      { offset: 1, color: second },
                    ],
                  }
                : {
                    type,
                    stops: [
                      { offset: 0, color: first },
                      { offset: 1, color: second },
                    ],
                  },
          )
        }
      />
      <div className="fields two">
        <ColorInput
          label={fill.type === 'solid' ? 'Body color' : 'First color'}
          value={first}
          onChange={(color) => changeStop(0, color)}
        />
        {fill.type !== 'solid' && (
          <ColorInput
            label="Second color"
            value={second}
            onChange={(color) => changeStop(1, color)}
          />
        )}
      </div>
      {fill.type === 'linear' && (
        <label className="field">
          Rotation · {fill.rotation}°
          <input
            type="range"
            min={0}
            max={360}
            value={fill.rotation}
            onChange={(event) =>
              setFill({ ...fill, rotation: Number(event.target.value) })
            }
          />
        </label>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={
            design.cornerFrame.color === null && design.cornerDot.color === null
          }
          onChange={(event) =>
            setDesign({
              ...design,
              cornerFrame: {
                ...design.cornerFrame,
                color: event.target.checked ? null : first,
              },
              cornerDot: {
                ...design.cornerDot,
                color: event.target.checked ? null : first,
              },
            })
          }
        />
        Corner color follows body
      </label>
      {design.cornerFrame.color !== null && (
        <ColorInput
          label="Corner color"
          value={design.cornerFrame.color}
          onChange={(color) =>
            setDesign({
              ...design,
              cornerFrame: { ...design.cornerFrame, color },
              cornerDot: { ...design.cornerDot, color },
            })
          }
        />
      )}
      <ColorInput
        label="Background color"
        value={design.background.color}
        onChange={(color) =>
          setDesign({ ...design, background: { ...design.background, color } })
        }
      />
      <label className="check">
        <input
          type="checkbox"
          role="switch"
          checked={design.background.transparent}
          onChange={(event) =>
            setDesign({
              ...design,
              background: {
                ...design.background,
                transparent: event.target.checked,
              },
            })
          }
        />
        Transparent background
      </label>
    </section>
  );
}
export function ShapesPanel() {
  const { design, setDesign } = useAppStore();
  return (
    <section className="panel">
      <h2>Shapes</h2>
      <ShapePicker
        label="Body"
        thumbnail={(shape, idPrefix) =>
          renderShapePreview('body', shape, { idPrefix })
        }
        value={design.body.shape}
        options={['square', 'rounded', 'dot', 'diamond', 'fluid']}
        onChange={(shape) =>
          setDesign({ ...design, body: { ...design.body, shape } })
        }
      />
      <ShapePicker
        label="Corner frame"
        thumbnail={(shape, idPrefix) =>
          renderShapePreview('cornerFrame', shape, { idPrefix })
        }
        value={design.cornerFrame.shape}
        options={['square', 'rounded', 'circle']}
        onChange={(shape) =>
          setDesign({
            ...design,
            cornerFrame: { ...design.cornerFrame, shape },
          })
        }
      />
      <ShapePicker
        label="Corner dot"
        thumbnail={(shape, idPrefix) =>
          renderShapePreview('cornerDot', shape, { idPrefix })
        }
        value={design.cornerDot.shape}
        options={['square', 'rounded', 'circle', 'diamond']}
        onChange={(shape) =>
          setDesign({ ...design, cornerDot: { ...design.cornerDot, shape } })
        }
      />
    </section>
  );
}
export async function readLogo(file: File): Promise<LogoOptions> {
  if (
    !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(
      file.type,
    )
  )
    throw new Error('Choose a PNG, JPEG, WebP or SVG image.');
  if (file.size > 2 * 1024 * 1024)
    throw new Error('Choose an image smaller than 2 MB.');
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
  const aspectRatio = await new Promise<number>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve(image.naturalWidth / image.naturalHeight)
        : reject(new Error('The image has no dimensions.'));
    image.onerror = () => reject(new Error('Unable to load this image.'));
    image.src = src;
  });
  return { src, aspectRatio, size: 0.2, padding: 1, clearModules: true };
}
export function LogoPanel() {
  const { design, setLogo } = useAppStore();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  async function upload(file?: File) {
    if (!file) return;
    const token = ++request.current;
    setBusy(true);
    setMessage('Reading image…');
    try {
      const logo = await readLogo(file);
      if (request.current === token)
        setMessage(
          setLogo(logo)
            ? 'Error correction raised to H for the logo.'
            : 'Logo added.',
        );
    } catch (error) {
      if (request.current === token) setMessage(errorMessage(error));
    } finally {
      if (request.current === token) setBusy(false);
    }
  }
  function updateLogo(patch: Partial<LogoOptions>) {
    if (design.logo) setLogo({ ...design.logo, ...patch });
  }
  return (
    <section className="panel">
      <h2>Logo</h2>
      <label
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files[0]);
        }}
      >
        Choose an image or drop it here
        <span>PNG, JPEG, WebP or SVG · up to 2 MB</span>
        <input
          aria-label="Upload logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <p className="status" role="status">
        {message}
      </p>
      {design.logo && (
        <>
          <label className="field">
            Logo size · {Math.round(design.logo.size * 100)}%
            <input
              type="range"
              min={10}
              max={30}
              value={Math.round(design.logo.size * 100)}
              onChange={(event) =>
                updateLogo({ size: Number(event.target.value) / 100 })
              }
            />
          </label>
          <label className="field">
            Logo padding · {design.logo.padding}
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={design.logo.padding}
              onChange={(event) =>
                updateLogo({ padding: Number(event.target.value) })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              role="switch"
              checked={design.logo.clearModules}
              onChange={(event) =>
                updateLogo({ clearModules: event.target.checked })
              }
            />
            Clear modules behind logo
          </label>
          <button
            type="button"
            onClick={() => {
              request.current++;
              setBusy(false);
              setLogo(null);
              setMessage('Logo removed.');
            }}
          >
            Remove logo
          </button>
        </>
      )}
    </section>
  );
}
export function AdvancedPanel() {
  const { design, setDesign, resetDesign } = useAppStore();
  return (
    <section className="panel">
      <h2>Advanced</h2>
      <label className="field">
        Error correction
        <select
          value={design.errorCorrection}
          onChange={(event) =>
            setDesign({
              ...design,
              errorCorrection: event.target
                .value as QrDesign['errorCorrection'],
            })
          }
        >
          <option value="L">L · 7% recovery</option>
          <option value="M">M · 15% recovery</option>
          <option value="Q">Q · 25% recovery</option>
          <option value="H">H · 30% recovery</option>
        </select>
      </label>
      <label className="field">
        Quiet zone · {design.margin} modules
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={design.margin}
          onChange={(event) =>
            setDesign({ ...design, margin: Number(event.target.value) })
          }
        />
      </label>
      <button type="button" onClick={resetDesign}>
        Reset design
      </button>
    </section>
  );
}
