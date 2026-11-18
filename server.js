const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieSession = require("cookie-session");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

// Simple admin password (change this via env var before deploying)
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "changeme123";
const SESSION_SECRET = process.env.SESSION_SECRET || "replace-this-secret-key";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  cookieSession({
    name: "session",
    keys: [SESSION_SECRET],
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
  })
);

function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

// ---------- Public: Status Check ----------
app.post("/api/status-check", (req, res) => {
  const { applicationId, mobile } = req.body;

  if (!applicationId || !mobile) {
    return res.status(400).json({ error: "Application ID and Mobile number are required" });
  }

  const db = readDB();
  const app_ = db.applications.find(
    (a) =>
      a.applicationId.toLowerCase() === String(applicationId).trim().toLowerCase() &&
      a.mobile === String(mobile).trim()
  );

  if (!app_) {
    return res.status(404).json({ error: "No application found with these details" });
  }

  return res.json({
    applicationId: app_.applicationId,
    customerName: app_.customerName,
    loanType: app_.loanType,
    loanAmount: app_.loanAmount,
    status: app_.status,
    remarks: app_.remarks,
    lastUpdated: app_.lastUpdated,
  });
});

// ---------- Admin: Auth ----------
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/admin/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get("/api/admin/me", (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------- Admin: Manage Applications ----------
app.get("/api/admin/applications", requireAdmin, (req, res) => {
  const db = readDB();
  res.json(db.applications);
});

app.post("/api/admin/applications", requireAdmin, (req, res) => {
  const { applicationId, customerName, mobile, loanType, loanAmount, status, remarks } = req.body;

  if (!applicationId || !customerName || !mobile) {
    return res.status(400).json({ error: "Application ID, Customer name and Mobile are required" });
  }

  const db = readDB();
  const exists = db.applications.find(
    (a) => a.applicationId.toLowerCase() === String(applicationId).trim().toLowerCase()
  );
  if (exists) {
    return res.status(409).json({ error: "Application ID already exists" });
  }

  const newApp = {
    applicationId: String(applicationId).trim(),
    customerName,
    mobile: String(mobile).trim(),
    loanType: loanType || "",
    loanAmount: Number(loanAmount) || 0,
    status: status || "Pending",
    remarks: remarks || "",
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  db.applications.push(newApp);
  writeDB(db);
  res.json({ success: true, application: newApp });
});

app.put("/api/admin/applications/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, remarks, loanAmount, loanType, customerName, mobile } = req.body;

  const db = readDB();
  const idx = db.applications.findIndex(
    (a) => a.applicationId.toLowerCase() === id.toLowerCase()
  );
  if (idx === -1) {
    return res.status(404).json({ error: "Application not found" });
  }

  const app_ = db.applications[idx];
  if (status !== undefined) app_.status = status;
  if (remarks !== undefined) app_.remarks = remarks;
  if (loanAmount !== undefined) app_.loanAmount = Number(loanAmount);
  if (loanType !== undefined) app_.loanType = loanType;
  if (customerName !== undefined) app_.customerName = customerName;
  if (mobile !== undefined) app_.mobile = mobile;
  app_.lastUpdated = new Date().toISOString().slice(0, 10);

  writeDB(db);
  res.json({ success: true, application: app_ });
});

app.delete("/api/admin/applications/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const before = db.applications.length;
  db.applications = db.applications.filter(
    (a) => a.applicationId.toLowerCase() !== id.toLowerCase()
  );
  if (db.applications.length === before) {
    return res.status(404).json({ error: "Application not found" });
  }
  writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Loan Status Portal running at http://localhost:${PORT}`);
});
