// ==============================
// Chat Point Backend (server.cjs)
// ==============================

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const dotenv = require("dotenv");
const cors = require("cors");
const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");
const path = require("path");

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// ==============================
// Middleware
// ==============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "public")));

// ==============================
// Cloudinary Config
// ==============================
if (process.env.CLOUDINARY_URL) {
  const cloudinaryUrl = new URL(process.env.CLOUDINARY_URL);
  const [api_key, api_secret] = [cloudinaryUrl.username, cloudinaryUrl.password];
  const cloud_name = cloudinaryUrl.hostname;
  cloudinary.config({ cloud_name, api_key, api_secret });
}

// ==============================
// MongoDB Connection
// ==============================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ==============================
// Owner & User Models
// ==============================
const ownerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const Owner = mongoose.model("Owner", ownerSchema);

const userSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String, required: true, unique: true },
  password: { type: String },
});
const User = mongoose.model("User", userSchema);

// ==============================
// Shop Model
// ==============================
const shopSchema = new mongoose.Schema({
  type: { type: String, default: "shop" },
  ownerName: String,
  mobile: String,
  shopName: String,
  itemName: String,
  price: Number,
  description: String,
  imageUrl: [String],
  date: { type: Date, default: Date.now },
});
const Shop = mongoose.model("Shop", shopSchema);

// ==============================
// Order Model
// ==============================
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  user: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
  },
  shop: { type: String, default: "Unknown Shop" },
  items: [
    {
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
  totalAmount: Number,
  deliveryCharge: Number,
  address: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  paymentMethod: { type: String, default: "cash" },
  status: { type: String, default: "pending" },
  date: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);

// ==============================
// Multer for file uploads
// ==============================
const upload = multer({ dest: "uploads/" });

// ==============================
// Owner Auth Routes
// ==============================
app.post("/api/owner/signup", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ success: false, message: "Phone and password required" });

    const existing = await Owner.findOne({ phone });
    if (existing) return res.status(400).json({ success: false, message: "Owner already exists" });

    const newOwner = new Owner({ phone, password });
    await newOwner.save();
    res.json({ success: true, message: "✅ Owner registered successfully" });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/owner/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const owner = await Owner.findOne({ phone });
    if (!owner) return res.status(404).json({ success: false, message: "❌ Owner not found" });
    if (owner.password !== password)
      return res.status(401).json({ success: false, message: "❌ Incorrect password" });

    res.json({ success: true, message: "✅ Login successful", owner });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==============================
// User Auth Routes
// ==============================
app.post("/api/user/signup", async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ success: false, message: "All fields required" });

    const existing = await User.findOne({ phone });
    if (existing) return res.status(400).json({ success: false, message: "User already exists" });

    const newUser = new User({ name, phone, password });
    await newUser.save();
    res.json({ success: true, message: "✅ User registered successfully" });
  } catch (err) {
    console.error("User Signup Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/user/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ success: false, message: "❌ User not found" });
    if (user.password !== password)
      return res.status(401).json({ success: false, message: "❌ Incorrect password" });

    res.json({ success: true, message: "✅ Login successful", user });
  } catch (err) {
    console.error("User Login Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==============================
// Shop Upload / Fetch / Delete
// ==============================
app.post("/api/upload", upload.array("photos", 5), async (req, res) => {
  try {
    const { ownerName, mobile, shopName, itemName, price, description, type } = req.body;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: "No images uploaded" });

    const imageUrls = [];
    for (const file of req.files) {
      try {
        const uploadResult = await cloudinary.uploader.upload(file.path, { folder: "chatpoint" });
        imageUrls.push(uploadResult.secure_url);
      } catch (uploadErr) {
        console.error("Cloudinary upload failed:", uploadErr);
      } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }

    const shop = new Shop({
      type: type || "shop",
      ownerName,
      mobile,
      shopName,
      itemName,
      price,
      description,
      imageUrl: imageUrls,
    });

    await shop.save();
    res.json({ success: true, message: "✅ Shop uploaded successfully", shop });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ success: false, message: "Failed to upload shop" });
  }
});

app.get("/api/shops", async (req, res) => {
  try {
    const shops = await Shop.find().sort({ date: -1 });
    res.json({ success: true, shops });
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch shops" });
  }
});

app.delete("/api/shop/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Shop.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Shop not found" });
    res.json({ success: true, message: "🗑️ Shop deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete shop" });
  }
});

// ==============================
// Orders
// ==============================
app.post("/api/order", async (req, res) => {
  try {
    const { userId, user, shop, items, totalAmount, deliveryCharge, address, paymentMethod } = req.body;

    if (
      !user?.name ||
      !user?.phone ||
      !items ||
      Object.keys(items).length === 0 ||
      !address?.line1 ||
      !address?.location
    ) {
      return res.status(400).json({ success: false, message: "Incomplete order data or location missing" });
    }

    const orderItems = Object.keys(items).map((name) => ({
      name,
      price: 100,
      quantity: items[name],
    }));

    const order = new Order({
      userId: userId || null,
      user,
      shop: shop || "Unknown Shop",
      items: orderItems,
      totalAmount,
      deliveryCharge,
      address: {
        ...address,
        location: {
          lat: parseFloat(address.location.split("Lat: ")[1].split(",")[0]),
          lng: parseFloat(address.location.split("Lng: ")[1]),
        },
      },
      paymentMethod: paymentMethod || "cash",
      status: paymentMethod === "cash" ? "pending" : "unpaid",
      date: new Date(),
    });

    await order.save();
    res.json({ success: true, message: "✅ Order placed successfully", order });
  } catch (err) {
    console.error("Order Save Error:", err);
    res.status(500).json({ success: false, message: "Failed to save order" });
  }
});

// Get orders by userId
app.get("/api/orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ date: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Fetch Orders Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// ==============================
// Health & Frontend Routes
// ==============================
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server running fine 🚀" });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/upload.html", (req, res) => res.sendFile(path.join(__dirname, "public", "upload.html")));
app.get("/home.html", (req, res) => res.sendFile(path.join(__dirname, "public", "home.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));

// Catch-all
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==============================
// Start Server
// ==============================
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
