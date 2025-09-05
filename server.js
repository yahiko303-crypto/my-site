import express from "express";
import path from "path";
import { fileURLToPath } from "url";
// ✅ NEW: Import Stripe + cors
import Stripe from "stripe";
import cors from "cors";

const app = express();
const PORT = 4000;

// ✅ NEW: Stripe setup
const STRIPE_SECRET_KEY = "sk_test_REPLACE_ME"; // <-- replace with your real secret key
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

// Helper for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ NEW: Enable CORS so frontend can talk to backend
app.use(cors());

// Serve static files
app.use(express.static(__dirname));

// JSON parser
app.use(express.json());

// 🔄 UPDATED: Stripe Checkout session route
app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: "Cart is empty" });

  try {
    // ✅ NEW: Map cart items into Stripe’s required line_items format
    const line_items = items.map(i => ({
      price_data: {
        currency: "usd",
        product_data: { name: i.name },
        unit_amount: Math.round(i.price * 100) // Stripe uses cents
      },
      quantity: i.quantity
    }));

    // ✅ NEW: Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `http://127.0.0.1:8080/download-success.html?products=${items.map(i => i.id).join(',')}`,
      cancel_url: `http://127.0.0.1:8080/cart.html`
    });

    // ✅ NEW: Return the Stripe Checkout session URL
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe checkout failed" });
  }
});

// Download route (same as before, unchanged)
app.get("/download/:productId", (req, res) => {
  const productId = req.params.productId;

  const files = {
    "1": "drake-dancing.zip",
    "2": "hammer-girl.zip",
    "3": "dancing-guy.zip",
    "4": "green-dancer.zip",
    "5": "death-drummer.zip",
    "6": "wooden-bowl.zip",
    "7": "ceramic-mug.zip",
    "8": "leather-wallet.zip",
    "9": "heart-emote.zip"
  };

  const fileName = files[productId];
  if (!fileName) return res.status(404).send("File not found");

  const filePath = path.join(__dirname, "digital", fileName);
  res.download(filePath, fileName, err => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
