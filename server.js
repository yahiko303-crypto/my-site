import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import path from "path";
import geoip from "geoip-lite";
import Stripe from "stripe";
import cors from "cors";
import fetch from "node-fetch"; // For PayPal API calls
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

// ================================
// Stripe setup
// ================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

// ================================
// Trust proxy
// ================================
app.set("trust proxy", true);

// ================================
// Middleware
// ================================
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(path.resolve(), "public"))); // serve static files

// ================================
// Visitor logging middleware
// ================================
const visitorLogs = [];

app.use((req, res, next) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const geo = geoip.lookup(clientIp);

  visitorLogs.push({
    ip: clientIp,
    location: geo
      ? `${geo.city || "N/A"}, ${geo.region || "N/A"}, ${geo.country || "N/A"}`
      : "Unknown",
    time: new Date().toISOString(),
    path: req.originalUrl,
  });

  next();
});

// ================================
// Session configuration
// ================================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set to true if HTTPS
  })
);

// ================================
// Admin user
// ================================
const adminUser = {
  username: "admin",
  passwordHash: bcrypt.hashSync("mypassword", 10),
};

// Middleware to protect private routes
function requireLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

// ================================
// Login routes
// ================================
app.get("/login", (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="post" action="/login">
      <input type="text" name="username" placeholder="Username" required /><br/>
      <input type="password" name="password" placeholder="Password" required /><br/>
      <button type="submit">Login</button>
    </form>
  `);
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (
    username === adminUser.username &&
    (await bcrypt.compare(password, adminUser.passwordHash))
  ) {
    req.session.user = { username };
    res.redirect("/dashboard");
  } else {
    res.send("Invalid credentials. <a href='/login'>Try again</a>");
  }
});

// ================================
// Logout
// ================================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ================================
// Protected dashboard (visitor logs)
// ================================
app.get("/dashboard", requireLogin, (req, res) => {
  let html = `
    <h2>Welcome, ${req.session.user.username}</h2>
    <p>Visitor Logs:</p>
    <table border="1" cellpadding="5">
      <tr>
        <th>IP</th>
        <th>Location</th>
        <th>Time</th>
        <th>Page</th>
      </tr>
  `;

  visitorLogs.slice(-50).reverse().forEach((log) => {
    html += `
      <tr>
        <td>${log.ip}</td>
        <td>${log.location}</td>
        <td>${log.time}</td>
        <td>${log.path}</td>
      </tr>
    `;
  });

  html += "</table><a href='/logout'>Logout</a>";
  res.send(html);
});

// ================================
// Stripe Checkout (original)
// ================================
app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;
  if (!items || items.length === 0)
    return res.status(400).json({ error: "Cart is empty" });

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

// ================================
// PayPal Checkout (original)
// ================================
app.post("/capture-paypal-order", async (req, res) => {
  const { orderID } = req.body;

  try {
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

// ================================
// Start server
// ================================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
