// Shared helpers: responses, cookies, crypto, PayU hashing, demo PDF.
const enc = new TextEncoder();

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

export const bad = (message, status = 400) => json({ error: message }, status);

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(name, value, { maxAge = 604800, secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
}

export const clearCookie = (name) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function hex(bytes = 16) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha512Hex(text) {
  const buf = await crypto.subtle.digest("SHA-512", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export async function hashPassword(password, salt = hex(16)) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 120000, hash: "SHA-256" },
    material,
    256
  );
  return { hash: b64(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password, salt, expected) {
  const { hash } = await hashPassword(password, salt);
  if (!expected || hash.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i += 1) diff |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
export const oneLine = (value, max = 200) => clean(value, max).replace(/\s+/g, " ");
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());

export function toInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function money(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

export function originOf(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function avatarFor(name = "") {
  return String(name || "D").trim().charAt(0).toUpperCase();
}

/* ------------------------------- PayU ------------------------------------ */

export function payuRequestString({ key, txnid, amount, productinfo, firstname, email, udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "", salt }) {
  return [key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, "", "", "", "", "", salt].join("|");
}

export async function payuRequestHash(params) {
  return sha512Hex(payuRequestString(params));
}

// PayU has used a couple of spacing variants over the years for the reverse
// hash. Salt is always part of every candidate, so accepting a variant is safe.
export function payuReverseStrings({ salt, status, udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "", email, firstname, productinfo, amount, txnid, key }) {
  const tail = [udf5, udf4, udf3, udf2, udf1, email, firstname, productinfo, amount, txnid, key].join("|");
  return [
    `${salt}|${status}||||||${tail}`,
    `${salt}|${status}||||||||||${tail}`,
    `${salt}|${status}|||||||||||${tail}`,
  ];
}

export async function payuVerifyResponse(fields, salt) {
  const given = String(fields.hash || "").toLowerCase();
  if (!salt || !given) return false;
  const candidates = payuReverseStrings({ ...fields, salt });
  for (const candidate of candidates) {
    if ((await sha512Hex(candidate)) === given) return true;
  }
  return false;
}

/* --------------------------- demo placeholder PDF ------------------------ */

function pdfString(value) {
  return String(value)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(text, width = 74) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      lines.push(line.trim());
      line = word;
    } else {
      line += " " + word;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function demoPdf(title, subtitle, paragraphs = []) {
  const lines = [];
  lines.push("BT");
  lines.push("/F1 26 Tf 64 760 Td (" + pdfString(title) + ") Tj");
  lines.push("ET");
  lines.push("BT");
  lines.push("/F2 12 Tf 64 730 Td (" + pdfString(subtitle) + ") Tj");
  lines.push("ET");
  let y = 690;
  for (const para of paragraphs) {
    for (const line of wrap(para)) {
      lines.push("BT /F2 11 Tf 64 " + y + " Td (" + pdfString(line) + ") Tj ET");
      y -= 17;
      if (y < 70) break;
    }
    y -= 12;
    if (y < 70) break;
  }
  const stream = lines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += String(off).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60) || "ebook";
}

export function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
