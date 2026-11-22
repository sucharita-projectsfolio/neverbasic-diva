import React, { useEffect, useRef } from "react";
import { Link } from "../lib/api.jsx";

// The hero centrepiece: a physical-looking ebook built from real CSS 3D layers.
// It floats, breathes and tilts towards the pointer, with a moving specular
// highlight, page block, spine, floor shadow and reflection. No WebGL library,
// so it stays fast on a phone while still reading as a rendered object.
const PARTICLES = [
  { left: "6%", top: "18%", size: 5, delay: 0, drift: -14 },
  { left: "14%", top: "66%", size: 3, delay: 1.2, drift: 10 },
  { left: "24%", top: "8%", size: 4, delay: 2.4, drift: -8 },
  { left: "78%", top: "14%", size: 3, delay: 0.6, drift: 12 },
  { left: "88%", top: "58%", size: 6, delay: 1.8, drift: -10 },
  { left: "70%", top: "82%", size: 3, delay: 2.9, drift: 9 },
  { left: "46%", top: "4%", size: 2, delay: 3.4, drift: 7 },
  { left: "36%", top: "88%", size: 4, delay: 0.9, drift: -12 },
  { left: "94%", top: "34%", size: 2, delay: 2.1, drift: 14 },
  { left: "4%", top: "44%", size: 2, delay: 3.8, drift: 8 },
];

export default function Ebook3D({ ebook, price, note, badge, href }) {
  const scene = useRef(null);

  useEffect(() => {
    const node = scene.current;
    if (!node) return undefined;
    if (window.matchMedia("(hover: none)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let frame = 0;
    const onMove = (event) => {
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        node.style.setProperty("--tilt-y", `${(x * 30).toFixed(2)}deg`);
        node.style.setProperty("--tilt-x", `${(-y * 20).toFixed(2)}deg`);
        node.style.setProperty("--shine-x", `${(x * 90 + 50).toFixed(1)}%`);
        node.style.setProperty("--shine-y", `${(y * 90 + 50).toFixed(1)}%`);
        node.style.setProperty("--shift-x", `${(x * -18).toFixed(1)}px`);
        node.style.setProperty("--shift-y", `${(y * -10).toFixed(1)}px`);
        frame = 0;
      });
    };
    const onLeave = () => {
      node.style.setProperty("--tilt-y", "0deg");
      node.style.setProperty("--tilt-x", "0deg");
      node.style.setProperty("--shine-x", "50%");
      node.style.setProperty("--shine-y", "40%");
      node.style.setProperty("--shift-x", "0px");
      node.style.setProperty("--shift-y", "0px");
    };
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!ebook) return null;
  const cover = ebook.cover || "";
  const title = ebook.title || "Neverbasic Diva";
  // href={null} renders the book as a plain object (used on the product page,
  // where the whole grid is already inside its own navigation).
  const to = href === null ? "" : href || `/ebooks/${ebook.slug || ""}`;

  const book = (
    <div className="book3d-stage" ref={scene}>
      <span className="book3d-aurora" aria-hidden="true" />
      <span className="book3d-beam" aria-hidden="true" />
      <div className="book3d-particles" aria-hidden="true">
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            style={{
              left: particle.left,
              top: particle.top,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              "--drift": `${particle.drift}px`,
            }}
          />
        ))}
      </div>

      <div className="book3d-float">
        <div className="book3d" role="img" aria-label={`${title} — ebook cover`}>
          <div className="book3d-inner" aria-hidden="true">
            <span />
          </div>
          <div className="book3d-pages" aria-hidden="true" />
          <div className="book3d-back" aria-hidden="true" />
          <div className="book3d-cover">
            {cover ? (
              <img src={cover} alt="" width="600" height="800" loading="eager" decoding="async" />
            ) : (
              <span className="book3d-cover-fallback">
                <small>neverbasic diva</small>
                <strong>{title}</strong>
              </span>
            )}
            <span className="book3d-shine" aria-hidden="true" />
            <span className="book3d-glare" aria-hidden="true" />
            <span className="book3d-grain" aria-hidden="true" />
          </div>
          <div className="book3d-spine" aria-hidden="true">
            <span>{title}</span>
          </div>
          <div className="book3d-edge" aria-hidden="true" />
        </div>
      </div>

      <div className="book3d-shadow" aria-hidden="true" />
      <div className="book3d-reflect" aria-hidden="true" />

      {price ? (
        <span className="book3d-price">
          {badge ? <em className="book3d-price-top">{badge}</em> : null}
          <strong>{price}</strong>
          {note ? <small>{note}</small> : null}
        </span>
      ) : badge ? (
        <span className="book3d-badge">{badge}</span>
      ) : null}
    </div>
  );

  return to ? (
    <Link to={to} className="book3d-link" aria-label={title}>
      {book}
    </Link>
  ) : (
    book
  );
}
