const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple admin password (change this via env var before deploying)
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "changeme123";
const SESSION_SECRET = process.env.SESSION_SECRET || "replace-this-secret-key";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseConfigured) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. " +
      "The server will start but all database calls will fail until these are set."
  );
}

// Server-side client using the service role key — never expose this key to the browser.
// A placeholder URL is used when unconfigured so createClient() doesn't throw at startup;
// requireSupabase() below returns a clean error response instead of crashing the process.
const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
  { auth: { persistSession: false } }
);

function requireSupabase(res) {
  if (!supabaseConfigured) {
    res.status(500).json({
      error: "Server is not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.",
    });
    return false;
  }
  return true;
}

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

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

function toApiShape(row) {
  return {
    applicationId: row.application_id,
    customerName: row.customer_name,
    mobile: row.mobile,
    loanType: row.loan_type,
    loanAmount: row.loan_amount,
    status: row.status,
    remarks: row.remarks,
    lastUpdated: row.last_updated,
  };
}

// ---------- Public: Status Check ----------
app.post("/api/status-check", async (req, res) => {
  const { applicationId, mobile } = req.body;

  if (!applicationId || !mobile) {
    return res.status(400).json({ error: "Application ID and Mobile number are required" });
  }
  if (!requireSupabase(res)) return;

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .ilike("application_id", String(applicationId).trim())
    .eq("mobile", String(mobile).trim())
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
  if (!data) {
    return res.status(404).json({ error: "No application found with these details" });
  }

  return res.json(toApiShape(data));
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
app.get("/api/admin/applications", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load applications" });
  }
  res.json(data.map(toApiShape));
});

app.post("/api/admin/applications", requireAdmin, async (req, res) => {
  const { applicationId, customerName, mobile, loanType, loanAmount, status, remarks } = req.body;

  if (!applicationId || !customerName || !mobile) {
    return res.status(400).json({ error: "Application ID, Customer name and Mobile are required" });
  }
  if (!requireSupabase(res)) return;

  const { data: existing } = await supabase
    .from("applications")
    .select("application_id")
    .ilike("application_id", String(applicationId).trim())
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "Application ID already exists" });
  }

  const newRow = {
    application_id: String(applicationId).trim(),
    customer_name: customerName,
    mobile: String(mobile).trim(),
    loan_type: loanType || "",
    loan_amount: Number(loanAmount) || 0,
    status: status || "Pending",
    remarks: remarks || "",
    last_updated: new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await supabase.from("applications").insert(newRow).select().single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to add application" });
  }

  res.json({ success: true, application: toApiShape(data) });
});

app.put("/api/admin/applications/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, remarks, loanAmount, loanType, customerName, mobile } = req.body;
  if (!requireSupabase(res)) return;

  const updates = { last_updated: new Date().toISOString().slice(0, 10) };
  if (status !== undefined) updates.status = status;
  if (remarks !== undefined) updates.remarks = remarks;
  if (loanAmount !== undefined) updates.loan_amount = Number(loanAmount);
  if (loanType !== undefined) updates.loan_type = loanType;
  if (customerName !== undefined) updates.customer_name = customerName;
  if (mobile !== undefined) updates.mobile = mobile;

  const { data, error } = await supabase
    .from("applications")
    .update(updates)
    .ilike("application_id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update application" });
  }
  if (!data) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.json({ success: true, application: toApiShape(data) });
});

app.delete("/api/admin/applications/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!requireSupabase(res)) return;

  const { data, error } = await supabase
    .from("applications")
    .delete()
    .ilike("application_id", id)
    .select();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete application" });
  }
  if (!data || data.length === 0) {
    return res.status(404).json({ error: "Application not found" });
  }

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Loan Status Portal running at http://localhost:${PORT}`);
});
