// Netlify Server entry: runs the store's API (originally a Cloudflare Worker) on Netlify,
// and serves the single-page app shell for client-side routes.
import worker from "../../worker/index.js";
import { env } from "./bindings.mjs";

export default {
  // Netlify exposes edge geo data on the function context; pass the country
  // through so prices can default to the buyer's currency.
  fetch(request, context) {
    const country = context && context.geo && context.geo.country && context.geo.country.code;
    return worker.fetch(request, country ? { ...env, GEO_COUNTRY: country } : env);
  },
};
