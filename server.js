import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import cors from "cors";
import basicAuth from "basic-auth"; // ✅ for admin login
// ❌ removed "node-fetch" – Node 22+ has fetch built in
import "dotenv/config";

const app = express();
const PORT = 4000;

// Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

// Helper for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS
app.use(
  cors({
    origin: "https://djsdopedesigns.com",
  })
);

// Serve static files
app.use(express.static(__dirname));

// JSON parser
app.use(express.json());

/* ================================
   VISITOR TRACKING
================================ */
const visits = []; // in-memory store (replace with DB if needed)

// helper to get IP
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress;
}

// middleware: log each visit
app.use(async (req, res, next) => {
  if (req.path.startsWith("/admin")) return next(); // skip admin route logging

  try {
    const ip = getClientIp(req);
    const apiUrl = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
    const r = await fetch(apiUrl);
    const geo = await r.json().catch(() => ({}));

    const entry = {
      ip,
      country: geo.country_name || geo.country || null,
      region: geo.region || null,
      city: geo.city || null,
      org: geo.org || null,
      timestamp: new Date().toISOString(),
    };

    visits.unshift(entry);
    if (visits.length > 200) visits.pop(); // keep last 200
    console.log("Visit:", entry);
  } catch (err) {
    console.error("Geo lookup failed:", err);
  }

  next();
});

// basic auth middleware
function requireAdmin(req, res, next) {
  const user = basicAuth(req);
  const ADMIN_USER = process.env.ADMIN_USER || "admin";
  const ADMIN_PASS = process.env.ADMIN_PASS || "changeme";

  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Authentication required");
  }
  next();
}

// admin view
app.get("/admin/visitors", requireAdmin, (req, res) => {
  res.json(visits);
});

/* ================================
   STRIPE CHECKOUT
================================ */
app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: "Cart is empty" });

  try {
    const line_items = items.map((i) => ({
      price_data: {
        currency: "usd",
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100),
      },
      quantity: i.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `https://djsdopedesigns.com/download-success.html?products=${items
        .map((i) => i.id)
        .join(",")}`,
      cancel_url: `https://djsdopedesigns.com/cart.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe checkout failed" });
  }
});

/* ================================
   PAYPAL CHECKOUT
================================ */
app.post("/capture-paypal-order", async (req, res) => {
  const { orderID } = req.body;

  try {
    // Get access token from PayPal
    const auth = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET_KEY
          ).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    const authData = await auth.json();

    // Capture order
    const capture = await fetch(
      `https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.access_token}`,
        },
      }
    );
    const data = await capture.json();

    if (data.status === "COMPLETED") {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, details: data });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ================================
   FILE DOWNLOADS
================================ */
app.get("/download/:productId", (req, res) => {
  const productId = req.params.productId;

  const files = {
    "1": "drake-dancing.zip",
    "2": "hammer-girl.zip",
    "3": "dancing-guy.zip",
    "4": "green-dancer.zip",
    "5": "death-drummer.zip",
    "6": "dancing-banana.zip",
    "7": "ceramic-mug.zip",
    "8": "leather-wallet.zip",
    "9": "heart-emote.zip",
  };

  const fileName = files[productId];
  if (!fileName) return res.status(404).send("File not found");

  const filePath = path.join(__dirname, "digital", fileName);
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
