import React from "react";
import { Link, money } from "../lib/api.jsx";
import { Cover, Reveal } from "../ui.jsx";

export default function EbookCard({ ebook, index = 0 }) {
  return (
    <Reveal delay={(index % 4) * 70} className="card-wrap">
      <Link to={`/ebooks/${ebook.slug}`} className="ebook-card">
        <div className="ebook-cover">
          <Cover ebook={ebook} />
          {ebook.badge ? <span className="card-badge">{ebook.badge}</span> : null}
          <span className="card-price">{money(ebook.price)}</span>
        </div>
        <div className="ebook-body">
          <span className="ebook-cat">
            {ebook.category}
            {ebook.pages ? ` · ${ebook.pages} pages` : ""}
          </span>
          <h3>{ebook.title}</h3>
          <p>{ebook.subtitle}</p>
          <div className="ebook-foot">
            <span className="ebook-price">
              {money(ebook.price)}
              {ebook.mrp > ebook.price ? <s>{money(ebook.mrp)}</s> : null}
            </span>
            <span className="ebook-arrow" aria-hidden="true">
              →
            </span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
