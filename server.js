import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 4000;

// Helper for __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (images, css, etc.)
app.use(express.static(__dirname));

// JSON parser
app.use(express.json());

// Example Stripe Checkout session route
app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;

  // Here you would create Stripe checkout session
  // For demo purposes, we'll just return a dummy URL
  res.json({ url: `/download/${items[0].id}` });
});

// **Download route**
app.get("/download/:productId", (req, res) => {
  const productId = req.params.productId;

  // Map product IDs to filenames in your /digital folder
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

  if (!fileName) {
    return res.status(404).send("File not found");
  }

  // Full path to the file
  const filePath = path.join(__dirname, "digital", fileName);

  // Send file for download
  res.download(filePath, fileName, err => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Error downloading file");
    }
  });
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
