import { api, navigate, rememberOrder } from "./api.jsx";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

export function startPayment(result, email) {
  if (email) rememberOrder(result.ref, email);
  const ref = encodeURIComponent(result.ref);

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

  if (result.mode === "razorpay" && result.key && result.orderId) {
    loadScript("https://checkout.razorpay.com/v1/checkout.js")
      .then(() => {
        if (!window.Razorpay) throw new Error("Payment window unavailable.");
        const checkout = new window.Razorpay({
          key: result.key,
          order_id: result.orderId,
          amount: Math.round(Number(result.amount) * 100),
          currency: result.currency || "INR",
          name: result.name || "Neverbasic Diva",
          description: result.description || result.itemTitle,
          prefill: result.prefill || { email },
          notes: { ref: result.ref },
          theme: { color: "#B0665A" },
          handler: async (response) => {
            try {
              const verified = await api("/api/razorpay/verify", {
                method: "POST",
                body: { ...response, ref: result.ref },
              });
              navigate(verified.redirect || `/order/${ref}?pay=success`);
            } catch {
              navigate(`/order/${ref}?pay=failed&reason=verify`);
            }
          },
          modal: {
            ondismiss: () => navigate(`/order/${ref}`),
          },
        });
        checkout.open();
      })
      .catch(() => navigate(`/order/${ref}?pay=failed&reason=checkout_script`));
    return;
  }

  if (result.mode === "stripe" && result.url) {
    window.location.href = result.url;
    return;
  }

  navigate(`/order/${ref}`);
}
