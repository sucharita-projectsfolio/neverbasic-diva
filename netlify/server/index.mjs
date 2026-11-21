// Netlify Server entry: runs the store's API (originally a Cloudflare Worker) on Netlify,
// and serves the single-page app shell for client-side routes.
import worker from "../../worker/index.js";
import { env } from "./bindings.mjs";

export default {
  fetch(request) {
    return worker.fetch(request, env);
  },
};
