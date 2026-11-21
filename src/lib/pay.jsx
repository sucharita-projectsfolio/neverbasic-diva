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

// Which buttons make sense for this currency, using the public gateway flags the
// server sends. PayPal/Stripe take non-INR money; PayU/Razorpay/UPI take INR.
export function methodsForCurrency(payment = {}, currency = "INR") {
  const code = String(currency || "INR").toUpperCase();
  const methods = [];
  if (code !== "INR" && payment.paypal) {
    methods.push({ id: "paypal", label: "PayPal", note: "PayPal balance, cards and wallets — no PayPal account needed" });
  }
  if (code !== "INR" && payment.stripe) {
    methods.push({ id: "stripe", label: "Card", note: "Visa, Mastercard, Amex via Stripe" });
  }
  if (code === "INR" && payment.payu) {
    methods.push({ id: "payu", label: "PayU", note: "UPI, cards, netbanking, wallets" });
  }
  if (code === "INR" && payment.razorpay) {
    methods.push({ id: "razorpay", label: "Razorpay", note: "UPI, cards, netbanking, wallets" });
  }
  if (code === "INR" && payment.upi && !methods.length) {
    methods.push({ id: "upi", label: "UPI transfer", note: `Pay the exact amount to ${payment.upi}` });
  }
  return methods;
}

export function startPayment(result, email) {
  if (!result) return "";
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
    return "payu";
  }

  if (result.mode === "razorpay" && result.key && result.orderId) {
    loadScript("https://checkout.razorpay.com/v1/checkout.js")
      .then(() => {
        if (!window.Razorpay) throw new Error("Payment window unavailable.");
        const checkout = new window.Razorpay({
          key: result.key,
          order_id: result.orderId,
          amount: Math.round(Number(result.amountCharged || result.amount) * 100),
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
    return "razorpay";
  }

  // PayPal and Stripe host the payment page; the buyer returns to our verified
  // capture endpoint, so nothing is unlocked from the browser alone.
  if ((result.mode === "paypal" || result.mode === "stripe") && result.url) {
    window.location.href = result.url;
    return result.mode;
  }

  navigate(`/order/${ref}${result.mode === "link" || result.mode === "manual" ? "" : "?pay=pending"}`);
  return result.mode || "manual";
}
