import type { CSSProperties } from 'react'
import type { ImageCropRect } from '@/lib/studio/types'

// Renders an image showing ONLY its cropped region.
//
// A crop on the moodboard is a real editorial decision — the designer framed
// the arm detail, not the whole showroom photo — so everywhere that picture is
// shown to a supplier it has to arrive cropped. Server-side rendering (the RFQ
// PDF) re-cuts the pixels with sharp; on the web there is nothing to re-cut, so
// the crop is expressed in CSS instead.
//
// The maths: an outer box clips, an inner box carries the crop's aspect ratio,
// and the <img> inside it is scaled by natural/crop and offset by -x/-y. Because
// left/top percentages resolve against the inner box (which *is* the crop), the
// result is exact at any size.
//
// `fit` matches object-fit on the cropped region: 'cover' fills the box (for
// fixed-size thumbnails), 'contain' fits inside it (for a lightbox).
export function CroppedImage({
  src,
  alt,
  crop,
  naturalWidth,
  naturalHeight,
  className = '',
  style,
  fit = 'cover',
  crossOrigin,
}: {
  src: string
  alt: string
  crop?: ImageCropRect | null
  naturalWidth?: number | null
  naturalHeight?: number | null
  className?: string
  style?: CSSProperties
  fit?: 'cover' | 'contain'
  crossOrigin?: 'anonymous'
}) {
  const usable =
    crop &&
    crop.width > 0 &&
    crop.height > 0 &&
    !!naturalWidth &&
    !!naturalHeight

  if (!usable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        crossOrigin={crossOrigin}
        className={className}
        style={{ objectFit: fit, ...style }}
      />
    )
  }

  const c = crop!
  const ratio = c.width / c.height
  // 'cover': the inner box overflows the shorter axis and the outer box clips.
  // 'contain': it fits, so the outer box may show through around it.
  const inner: CSSProperties =
    fit === 'cover'
      ? {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          minWidth: '100%',
          minHeight: '100%',
          aspectRatio: `${c.width} / ${c.height}`,
        }
      : {
          // Fitting inside a box without distorting it has to be done on ONE
          // axis: the width. Height stays auto so aspect-ratio derives it —
          // clamping height with max-height instead would squash the picture,
          // and an auto width collapses to zero because the only content is an
          // absolutely-positioned <img>. So the height limit is expressed as a
          // width: whatever the available height allows at this ratio, or the
          // full width, whichever is smaller. `--crop-avail-h` is that height,
          // set by the container (default: the viewport).
          width: `min(100%, calc(var(--crop-avail-h, 100vh) * ${ratio}))`,
          height: 'auto',
          maxWidth: '100%',
          aspectRatio: `${c.width} / ${c.height}`,
        }

  return (
    <span
      className={className}
      style={{
        display: fit === 'cover' ? 'block' : 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        // 'contain' needs a definite box to measure its 100% against — the
        // caller gives it one; this just fills it.
        ...(fit === 'contain' ? { width: '100%', height: '100%' } : {}),
        ...style,
      }}
    >
      <span style={{ ...inner, display: 'block', position: fit === 'cover' ? 'absolute' : 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          crossOrigin={crossOrigin}
          style={{
            position: 'absolute',
            width: `${(naturalWidth! / c.width) * 100}%`,
            height: `${(naturalHeight! / c.height) * 100}%`,
            left: `${(-c.x / c.width) * 100}%`,
            top: `${(-c.y / c.height) * 100}%`,
            maxWidth: 'none',
          }}
        />
      </span>
    </span>
  )
}
