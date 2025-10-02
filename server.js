import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import path from "path";
import geoip from "geoip-lite"; // ✅ Added for IP/location logging

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ================================
// Visitor logging middleware
// ================================
const visitorLogs = [];

app.use((req, res, next) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const geo = geoip.lookup(clientIp);

  visitorLogs.push({
    ip: clientIp,
    location: geo ? `${geo.city || 'N/A'}, ${geo.region || 'N/A'}, ${geo.country || 'N/A'}` : "Unknown",
    time: new Date().toISOString(),
    path: req.originalUrl,
  });

  next();
});

// ================================
// Configure session
// ================================
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey", // put a strong secret in Render env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set to true if you enforce HTTPS
  })
);

// Example: one admin user (can later pull from DB)
const adminUser = {
  username: "admin",
  // password = "mypassword" (hashed with bcrypt.hashSync("mypassword", 10))
  passwordHash: bcrypt.hashSync("mypassword", 10)
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
// Public: Login page
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

// Handle login
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
// Protected dashboard (only for logged-in users)
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

  // Show last 50 visitors (most recent first)
  visitorLogs.slice(-50).reverse().forEach(log => {
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
// Logout
// ================================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
