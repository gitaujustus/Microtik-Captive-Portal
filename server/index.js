const express = require("express");
const radius = require("node-radius");
const { stkPush } = require("./stkpush");
const bodyParser = require("body-parser");
const cors = require("cors");
const { mpesaCallback } = require("./mpesacallback").default;
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

// Initialize Supabase client
console.log("Herrree", process.env.SUPABASE_URL);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// In-memory store for active sessions
const activeSessions = new Map();

// Function to refresh active sessions from Supabase
async function refreshActiveSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .gt("expires", new Date().toISOString());
  if (error) {
    console.error("Error fetching sessions:", error);
  } else {
    activeSessions.clear();
    data.forEach((session) => activeSessions.set(session.mac_address, session));
  }
}

// Refresh every 30 seconds and run initially
setInterval(refreshActiveSessions, 30 * 1000);
refreshActiveSessions();

// STK Push API Route
app.post("/api/stkpush", stkPush);
// Mpesa Callback Route
app.post("/api/callback", mpesaCallback);

app.get("/", (req, res) => {
  res.send("Hello World from the server");
});

// RADIUS Server
const radiusServer = radius.createServer({
  host: "0.0.0.0",
  port: 1812,
  secret: "your-shared-secret",
});
radiusServer.on("accessRequest", (packet, rinfo) => {
  const username = packet.attributes["User-Name"][0];
  const password = packet.attributes["User-Password"][0];

  if (password === "mac_auth_pass") {
    // MAC-based authentication
    const session = activeSessions.find(
      (s) => s.mac === username && new Date(s.expires_at) > new Date()
    );
    if (session) {
      radiusServer.sendAccessAccept(packet, rinfo);
    } else {
      radiusServer.sendAccessReject(packet, rinfo);
    }
  } else if (password === "code_auth_pass") {
    // Code-based authentication
    const session = activeSessions.find(
      (s) => s.code === username && new Date(s.expires_at) > new Date()
    );
    if (session) {
      radiusServer.sendAccessAccept(packet, rinfo);
    } else {
      radiusServer.sendAccessReject(packet, rinfo);
    }
  } else {
    // Unknown password
    radiusServer.sendAccessReject(packet, rinfo);
  }
});
radiusServer.listen();



// API to validate code
app.post("/api/validate-code", async (req, res) => {
  const { code } = req.body;
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code)
    .gt("expires", new Date().toISOString())
    .single();
  if (error || !session) {
    res.json({ message: "Invalid or expired code" });
  } else {
    res.json({ message: "Code valid, reconnecting..." });
  }
});

app.listen(8000, () => console.log("Backend running on port 8000"));
