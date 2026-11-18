import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_USER = Deno.env.get("ADMIN_USER") || "admin";
const ADMIN_PASS = Deno.env.get("ADMIN_PASS") || "changeme123";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BASE = "/functions/v1/portal";

// CORS: the browser pages are hosted elsewhere (e.g. GitHub Pages), not on
// this Supabase domain, so every response needs these headers, and preflight
// (OPTIONS) requests must be answered directly.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-user, x-admin-pass",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function html(content: string) {
  return new Response(content, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
  });
}

function isAdmin(req: Request) {
  const u = req.headers.get("x-admin-user");
  const p = req.headers.get("x-admin-pass");
  return u === ADMIN_USER && p === ADMIN_PASS;
}

function toApiShape(row: Record<string, unknown>) {
  return {
    applicationId: row.application_id,
    customerName: row.customer_name,
    mobile: row.mobile,
    loanType: row.loan_type,
    loanAmount: row.loan_amount,
    status: row.status,
    remarks: row.remarks,
    lastUpdated: row.last_updated,
    verified: row.verified,
    verifiedDate: row.verified_date,
    verifiedBy: row.verified_by,
  };
}

const CUSTOMER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Loan Application Status Check</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
    font-family: system-ui,-apple-system,Segoe UI,sans-serif; background:#f1f5f9; color:#172033; }
  main { width:100%; max-width:460px; padding:32px; background:#fff; border-radius:16px;
    box-shadow:0 6px 24px rgba(0,0,0,0.08); }
  h1 { font-size:22px; margin:0 0 6px; text-align:center; }
  p.sub { text-align:center; color:#64748b; margin:0 0 24px; font-size:14px; }
  label { display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:#334155; }
  input { width:100%; padding:11px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:15px; margin-bottom:16px; }
  input:focus { outline:2px solid #2563eb; border-color:transparent; }
  button { width:100%; padding:12px; border:none; border-radius:8px; background:#2563eb; color:#fff;
    font-size:15px; font-weight:600; cursor:pointer; }
  button:hover { background:#1d4ed8; }
  button:disabled { background:#93c5fd; cursor:not-allowed; }
  #result { margin-top:20px; padding:16px; border-radius:10px; display:none; }
  #result.show { display:block; }
  #result.ok { background:#f0fdf4; border:1px solid #bbf7d0; }
  #result.err { background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; }
  .row { display:flex; justify-content:space-between; padding:4px 0; font-size:14px; }
  .row span:first-child { color:#64748b; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; color:#fff; }
  .st-pending, .st-under-review { background:#f59e0b; }
  .st-approved { background:#16a34a; }
  .st-rejected { background:#dc2626; }
  .st-disbursed { background:#2563eb; }
  footer { text-align:center; margin-top:20px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
<main>
  <h1>Check Your Loan Application Status</h1>
  <p class="sub">Enter your Application ID and registered mobile number</p>
  <form id="statusForm">
    <label for="applicationId">Application ID</label>
    <input type="text" id="applicationId" placeholder="e.g. DSA1001" required />
    <label for="mobile">Registered Mobile Number</label>
    <input type="tel" id="mobile" placeholder="10-digit mobile number" pattern="[0-9]{10}" maxlength="10" required />
    <button type="submit" id="submitBtn">Check Status</button>
  </form>
  <div id="result"></div>
  <footer>&copy; 2026 &mdash; For support, contact your relationship manager.</footer>
</main>
<script>
  const BASE = "${BASE}";
  const form = document.getElementById("statusForm");
  const resultDiv = document.getElementById("result");
  const submitBtn = document.getElementById("submitBtn");
  function statusClass(status) { return "st-" + status.toLowerCase().replace(/\\s+/g, "-"); }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const applicationId = document.getElementById("applicationId").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    resultDiv.className = ""; resultDiv.innerHTML = "";
    submitBtn.disabled = true; submitBtn.textContent = "Checking...";
    try {
      const res = await fetch(BASE + "/api/status-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, mobile }),
      });
      const data = await res.json();
      if (!res.ok) {
        resultDiv.className = "show err"; resultDiv.textContent = data.error || "Something went wrong";
      } else {
        resultDiv.className = "show ok";
        resultDiv.innerHTML =
          '<div class="row"><span>Applicant</span><span>' + data.customerName + '</span></div>' +
          '<div class="row"><span>Loan Type</span><span>' + (data.loanType || "-") + '</span></div>' +
          '<div class="row"><span>Loan Amount</span><span>\u20B9' + Number(data.loanAmount).toLocaleString("en-IN") + '</span></div>' +
          '<div class="row"><span>Status</span><span class="status-badge ' + statusClass(data.status) + '">' + data.status + '</span></div>' +
          '<div class="row"><span>Remarks</span><span>' + (data.remarks || "-") + '</span></div>' +
          '<div class="row"><span>Last Updated</span><span>' + data.lastUpdated + '</span></div>';
      }
    } catch (err) {
      resultDiv.className = "show err"; resultDiv.textContent = "Network error. Please try again.";
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = "Check Status";
    }
  });
</script>
</body>
</html>`;

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Admin &mdash; Loan Applications</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,Segoe UI,sans-serif; background:#f1f5f9; color:#172033; padding:24px; }
  .wrap { max-width:960px; margin:0 auto; }
  h1 { font-size:22px; margin-bottom:4px; }
  .sub { color:#64748b; font-size:14px; margin-bottom:20px; }
  #loginBox { max-width:380px; margin:60px auto; background:#fff; padding:28px; border-radius:14px; box-shadow:0 6px 24px rgba(0,0,0,0.08); }
  #loginBox h2 { margin-top:0; font-size:18px; }
  label { display:block; font-size:13px; font-weight:600; margin-bottom:6px; }
  input, select { width:100%; padding:10px; margin-bottom:14px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; }
  button { padding:10px 16px; border:none; border-radius:8px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; font-size:14px; }
  button:hover { background:#1d4ed8; }
  button.secondary { background:#64748b; }
  button.danger { background:#dc2626; }
  .err-msg { color:#dc2626; font-size:13px; margin-bottom:10px; }
  #dashboard { display:none; }
  .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .card { background:#fff; border-radius:12px; padding:20px; margin-bottom:20px; box-shadow:0 4px 16px rgba(0,0,0,0.06); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid #e2e8f0; }
  th { color:#64748b; font-weight:600; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; color:#fff; }
  .st-pending, .st-under-review { background:#f59e0b; }
  .st-approved { background:#16a34a; }
  .st-rejected { background:#dc2626; }
  .st-disbursed { background:#2563eb; }
  .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
  .actions button { padding:5px 10px; font-size:12px; margin-right:4px; }
</style>
</head>
<body>
<div class="wrap">
  <div id="loginBox">
    <h2>Admin Login</h2>
    <div class="err-msg" id="loginErr"></div>
    <label>Username</label>
    <input type="text" id="username" />
    <label>Password</label>
    <input type="password" id="password" />
    <button id="loginBtn">Login</button>
  </div>
  <div id="dashboard">
    <div class="topbar">
      <div>
        <h1>Loan Applications &mdash; Admin</h1>
        <p class="sub">Add new applications and update status</p>
      </div>
      <button class="secondary" id="logoutBtn">Logout</button>
    </div>
    <div class="card">
      <h3>Add New Application</h3>
      <div class="form-grid">
        <div><label>Application ID</label><input type="text" id="newId" placeholder="DSA1003" /></div>
        <div><label>Customer Name</label><input type="text" id="newName" /></div>
        <div><label>Mobile Number</label><input type="text" id="newMobile" maxlength="10" /></div>
        <div><label>Loan Type</label><input type="text" id="newLoanType" placeholder="Business Loan / Personal Loan" /></div>
        <div><label>Loan Amount (\u20B9)</label><input type="number" id="newAmount" /></div>
        <div>
          <label>Status</label>
          <select id="newStatus">
            <option>Pending</option><option>Under Review</option><option>Approved</option><option>Rejected</option><option>Disbursed</option>
          </select>
        </div>
      </div>
      <label>Remarks</label>
      <input type="text" id="newRemarks" placeholder="Optional note" />
      <button id="addBtn">Add Application</button>
      <div class="err-msg" id="addErr"></div>
    </div>
    <div class="card">
      <h3>All Applications</h3>
      <table id="appTable">
        <thead><tr><th>App ID</th><th>Name</th><th>Mobile</th><th>Type</th><th>Amount</th><th>Status</th><th>Remarks</th><th>Updated</th><th>Actions</th></tr></thead>
        <tbody id="appTableBody"></tbody>
      </table>
    </div>
  </div>
</div>
<script>
  const BASE = "${BASE}";
  const loginBox = document.getElementById("loginBox");
  const dashboard = document.getElementById("dashboard");

  function getCreds() {
    try {
      return {
        user: sessionStorage.getItem("adminUser") || "",
        pass: sessionStorage.getItem("adminPass") || "",
      };
    } catch (e) { return { user: "", pass: "" }; }
  }
  function setCreds(user, pass) {
    try { sessionStorage.setItem("adminUser", user); sessionStorage.setItem("adminPass", pass); } catch (e) {}
  }
  function clearCreds() {
    try { sessionStorage.removeItem("adminUser"); sessionStorage.removeItem("adminPass"); } catch (e) {}
  }
  function authHeaders() {
    const c = getCreds();
    return { "x-admin-user": c.user, "x-admin-pass": c.pass };
  }

  async function checkAuth() {
    const c = getCreds();
    if (!c.user) { showLogin(); return; }
    const r = await fetch(BASE + "/api/admin/applications", { headers: authHeaders() });
    if (r.ok) { showDashboard(); loadApplications(); }
    else { clearCreds(); showLogin(); }
  }
  function showLogin() { loginBox.style.display = "block"; dashboard.style.display = "none"; }
  function showDashboard() { loginBox.style.display = "none"; dashboard.style.display = "block"; }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errEl = document.getElementById("loginErr");
    errEl.textContent = "";
    const r = await fetch(BASE + "/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (r.ok) { setCreds(username, password); showDashboard(); loadApplications(); }
    else { const d = await r.json(); errEl.textContent = d.error || "Login failed"; }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => { clearCreds(); showLogin(); });

  function statusClass(status) { return "st-" + status.toLowerCase().replace(/\\s+/g, "-"); }

  async function loadApplications() {
    const r = await fetch(BASE + "/api/admin/applications", { headers: authHeaders() });
    if (!r.ok) { clearCreds(); showLogin(); return; }
    const apps = await r.json();
    const tbody = document.getElementById("appTableBody");
    tbody.innerHTML = "";
    apps.forEach((a) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + a.applicationId + "</td>" +
        "<td>" + a.customerName + "</td>" +
        "<td>" + a.mobile + "</td>" +
        "<td>" + (a.loanType || "-") + "</td>" +
        "<td>\u20B9" + Number(a.loanAmount).toLocaleString("en-IN") + "</td>" +
        "<td><select data-id=\\"" + a.applicationId + "\\" class=\\"statusSelect\\">" +
          ["Pending","Under Review","Approved","Rejected","Disbursed"].map(function(s){
            return "<option " + (s === a.status ? "selected" : "") + ">" + s + "</option>";
          }).join("") +
        "</select></td>" +
        "<td>" + (a.remarks || "-") + "</td>" +
        "<td>" + a.lastUpdated + "</td>" +
        "<td class=\\"actions\\">" +
          "<button class=\\"saveBtn\\" data-id=\\"" + a.applicationId + "\\">Save</button>" +
          "<button class=\\"danger deleteBtn\\" data-id=\\"" + a.applicationId + "\\">Delete</button>" +
        "</td>";
      tbody.appendChild(tr);
    });
    document.querySelectorAll(".saveBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const select = document.querySelector('.statusSelect[data-id="' + id + '"]');
        await fetch(BASE + "/api/admin/applications/" + encodeURIComponent(id), {
          method: "PUT",
          headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
          body: JSON.stringify({ status: select.value }),
        });
        loadApplications();
      });
    });
    document.querySelectorAll(".deleteBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete application " + btn.dataset.id + "?")) return;
        await fetch(BASE + "/api/admin/applications/" + encodeURIComponent(btn.dataset.id), {
          method: "DELETE", headers: authHeaders(),
        });
        loadApplications();
      });
    });
  }

  document.getElementById("addBtn").addEventListener("click", async () => {
    const errEl = document.getElementById("addErr");
    errEl.textContent = "";
    const payload = {
      applicationId: document.getElementById("newId").value.trim(),
      customerName: document.getElementById("newName").value.trim(),
      mobile: document.getElementById("newMobile").value.trim(),
      loanType: document.getElementById("newLoanType").value.trim(),
      loanAmount: document.getElementById("newAmount").value,
      status: document.getElementById("newStatus").value,
      remarks: document.getElementById("newRemarks").value.trim(),
    };
    const r = await fetch(BASE + "/api/admin/applications", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || "Failed to add"; return; }
    ["newId","newName","newMobile","newLoanType","newAmount","newRemarks"].forEach(function(id){
      document.getElementById(id).value = "";
    });
    loadApplications();
  });

  checkAuth();
</script>
</body>
</html>`;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let path = url.pathname;
  const idx = path.indexOf("/portal");
  if (idx !== -1) path = path.slice(idx + "/portal".length);
  if (path === "") path = "/";

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "GET" && path === "/") return html(CUSTOMER_HTML);
  if (req.method === "GET" && path === "/admin") return html(ADMIN_HTML);

  if (req.method === "POST" && path === "/api/status-check") {
    const body = await req.json().catch(() => ({}));
    const { applicationId, mobile } = body;
    if (!applicationId || !mobile) {
      return json({ error: "Application ID and Mobile number are required" }, 400);
    }
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .ilike("application_id", String(applicationId).trim())
      .eq("mobile", String(mobile).trim())
      .maybeSingle();
    if (error) return json({ error: "Something went wrong. Please try again." }, 500);
    if (!data) return json({ error: "No application found with these details" }, 404);
    return json(toApiShape(data));
  }

  if (req.method === "POST" && path === "/api/admin/login") {
    const body = await req.json().catch(() => ({}));
    if (body.username === ADMIN_USER && body.password === ADMIN_PASS) return json({ success: true });
    return json({ error: "Invalid credentials" }, 401);
  }

  if (path === "/api/admin/applications" || path.startsWith("/api/admin/applications/")) {
    if (!isAdmin(req)) return json({ error: "Not authenticated" }, 401);

    if (req.method === "GET" && path === "/api/admin/applications") {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: "Failed to load applications" }, 500);
      return json((data || []).map(toApiShape));
    }

    if (req.method === "POST" && path === "/api/admin/applications") {
      const body = await req.json().catch(() => ({}));
      const { applicationId, customerName, mobile, loanType, loanAmount, status, remarks } = body;
      if (!applicationId || !customerName || !mobile) {
        return json({ error: "Application ID, Customer name and Mobile are required" }, 400);
      }
      const { data: existing } = await supabase
        .from("applications")
        .select("application_id")
        .ilike("application_id", String(applicationId).trim())
        .maybeSingle();
      if (existing) return json({ error: "Application ID already exists" }, 409);

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
      if (error) return json({ error: "Failed to add application" }, 500);
      return json({ success: true, application: toApiShape(data) });
    }

    const idMatch = path.match(/^\/api\/admin\/applications\/(.+)$/);
    if (idMatch) {
      const id = decodeURIComponent(idMatch[1]);

      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const updates: Record<string, unknown> = { last_updated: new Date().toISOString().slice(0, 10) };
        if (body.status !== undefined) updates.status = body.status;
        if (body.remarks !== undefined) updates.remarks = body.remarks;
        if (body.loanAmount !== undefined) updates.loan_amount = Number(body.loanAmount);
        if (body.loanType !== undefined) updates.loan_type = body.loanType;
        if (body.customerName !== undefined) updates.customer_name = body.customerName;
        if (body.mobile !== undefined) updates.mobile = body.mobile;
        if (body.verified !== undefined) {
          updates.verified = Boolean(body.verified);
          updates.verified_date = body.verified ? new Date().toISOString().slice(0, 10) : null;
          if (body.verifiedBy !== undefined) updates.verified_by = body.verifiedBy;
        }

        const { data, error } = await supabase
          .from("applications")
          .update(updates)
          .ilike("application_id", id)
          .select()
          .maybeSingle();
        if (error) return json({ error: "Failed to update application" }, 500);
        if (!data) return json({ error: "Application not found" }, 404);
        return json({ success: true, application: toApiShape(data) });
      }

      if (req.method === "DELETE") {
        const { data, error } = await supabase
          .from("applications")
          .delete()
          .ilike("application_id", id)
          .select();
        if (error) return json({ error: "Failed to delete application" }, 500);
        if (!data || data.length === 0) return json({ error: "Application not found" }, 404);
        return json({ success: true });
      }
    }
  }

  return json({ error: "Not found" }, 404);
});
