import { navigate, rememberOrder } from "./api.jsx";

export function startPayment(result, email) {
  if (email) rememberOrder(result.ref, email);
  if (result.mode === "payu") {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = result.action;
    form.style.display = "none";
    for (const [key, value] of Object.entries(result.fields || {})) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value == null ? "" : String(value);
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return;
  }
  navigate(`/order/${encodeURIComponent(result.ref)}`);
}
