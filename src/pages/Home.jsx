import React from "react";
import { useSite } from "../lib/api.jsx";
import { readKit } from "../lib/sitekit.js";
import { BlockList } from "./blocks.jsx";

export default function Home() {
  const { site } = useSite();
  const kit = readKit(site);
  const settings = site?.settings || {};
  const tokens = {
    brand: settings.brand_name || "Neverbasic Diva",
    insta: settings.instagram || "neverbasic_diva",
    price: Number(settings.resell_price) || 399,
    count: (site?.ebooks || []).length,
    year: new Date().getFullYear(),
    refund_policy: settings.refund_policy || "",
  };

  return (
    <div className="home">
      <BlockList blocks={kit.blocks} site={site} tokens={tokens} />
    </div>
  );
}
