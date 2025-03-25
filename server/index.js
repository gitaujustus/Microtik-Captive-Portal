// const express = require("express");
// const radius = require("radius");
// const { stkPush } = require("./stkpush");
// const bodyParser = require("body-parser");
// const cors = require("cors");
// // const { mpesaCallback } = require("./mpesacallback").default;
// const { mpesaCallback } = require("./mpesacallback")
// const { createClient } = require("@supabase/supabase-js");
// require("dotenv").config();

// const app = express();
// app.use(express.json());
// app.use(bodyParser.json());
// app.use(cors());

// // Initialize Supabase client
// console.log("Herrree", process.env.SUPABASE_URL);
// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_KEY
// );

// // In-memory store for active sessions
// const activeSessions = new Map();

// // Function to refresh active sessions from Supabase
// async function refreshActiveSessions() {
//   const { data, error } = await supabase
//     .from("sessions")
//     .select("*")
//     .gt("expires", new Date().toISOString());
//   if (error) {
//     console.error("Error fetching sessions:", error);
//   } else {
//     activeSessions.clear();
//     data.forEach((session) => activeSessions.set(session.mac_address, session));
//   }
// }

// // Refresh every 30 seconds and run initially
// setInterval(refreshActiveSessions, 30 * 1000);
// refreshActiveSessions();

// // STK Push API Route
// app.post("/api/stkpush", stkPush);
// // Mpesa Callback Route
// app.post("/api/callback", mpesaCallback);

// app.get("/", (req, res) => {
//   res.send("Hello World from the server");
// });

// // RADIUS Server
// const radiusServer = radius.createServer({
//   host: "0.0.0.0",
//   port: 1812,
//   secret: "your-shared-secret",
// });
// radiusServer.on("accessRequest", (packet, rinfo) => {
//   const username = packet.attributes["User-Name"][0];
//   const password = packet.attributes["User-Password"][0];

//   if (password === "mac_auth_pass") {
//     // MAC-based authentication
//     const session = activeSessions.find(
//       (s) => s.mac === username && new Date(s.expires_at) > new Date()
//     );
//     if (session) {
//       radiusServer.sendAccessAccept(packet, rinfo);
//     } else {
//       radiusServer.sendAccessReject(packet, rinfo);
//     }
//   } else if (password === "code_auth_pass") {
//     // Code-based authentication
//     const session = activeSessions.find(
//       (s) => s.code === username && new Date(s.expires_at) > new Date()
//     );
//     if (session) {
//       radiusServer.sendAccessAccept(packet, rinfo);
//     } else {
//       radiusServer.sendAccessReject(packet, rinfo);
//     }
//   } else {
//     // Unknown password
//     radiusServer.sendAccessReject(packet, rinfo);
//   }
// });
// radiusServer.listen();



// // API to validate code
// app.post("/api/validate-code", async (req, res) => {
//   const { code } = req.body;
//   const { data: session, error } = await supabase
//     .from("sessions")
//     .select("*")
//     .eq("code", code)
//     .gt("expires", new Date().toISOString())
//     .single();
//   if (error || !session) {
//     res.json({ message: "Invalid or expired code" });
//   } else {
//     res.json({ message: "Code valid, reconnecting..." });
//   }
// });

// app.listen(8000, () => console.log("Backend running on port 8000"));


const express = require("express");
const radius = require("radius");
const { stkPush } = require("./stkpush");
const bodyParser = require("body-parser");
const cors = require("cors");
const { mpesaCallback } = require("./mpesacallback");
const { createClient } = require("@supabase/supabase-js");
const dgram = require("dgram"); // Add this for UDP server
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const activeSessions = new Map();

async function refreshActiveSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .gt("expires", new Date().toISOString());
  if (error) {
    console.error("Error fetching sessionssss:", error);
  } else {
    activeSessions.clear();
    data.forEach((session) => activeSessions.set(session.mac_address, session));
  }
}

setInterval(refreshActiveSessions, 30 * 1000);
refreshActiveSessions();

app.post("/api/stkpush", stkPush);
app.post("/api/callback", mpesaCallback);

app.get("/", (req, res) => {
  res.send("Hello World from the server");
});

// Create RADIUS server using dgram
const radiusServer = dgram.createSocket("udp4");
const SECRET = "your-shared-secret"; // Ensure this matches your RADIUS client

radiusServer.on("message", (msg, rinfo) => {
  try {
    const packet = radius.decode({ packet: msg, secret: SECRET });
    const username = packet.attributes["User-Name"];
    const password = packet.attributes["User-Password"];

    let response;
    if (password === "mac_auth_pass") {
      const session = Array.from(activeSessions.values()).find(
        (s) => s.mac_address === username && new Date(s.expires) > new Date()
      );
      if (session) {
        response = radius.encode({
          code: "Access-Accept",
          secret: SECRET,
          identifier: packet.identifier,
        });
      } else {
        response = radius.encode({
          code: "Access-Reject",
          secret: SECRET,
          identifier: packet.identifier,
        });
      }
    } else if (password === "code_auth_pass") {
      const session = Array.from(activeSessions.values()).find(
        (s) => s.code === username && new Date(s.expires) > new Date()
      );
      if (session) {
        response = radius.encode({
          code: "Access-Accept",
          secret: SECRET,
          identifier: packet.identifier,
        });
      } else {
        response = radius.encode({
          code: "Access-Reject",
          secret: SECRET,
          identifier: packet.identifier,
        });
      }
    } else {
      response = radius.encode({
        code: "Access-Reject",
        secret: SECRET,
        identifier: packet.identifier,
      });
    }

    radiusServer.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
      if (err) console.error("Error sending RADIUS response:", err);
    });
  } catch (e) {
    console.error("Error processing RADIUS packet:", e);
  }
});

radiusServer.on("listening", () => {
  const address = radiusServer.address();
  console.log(`RADIUS server listening on ${address.address}:${address.port}`);
});

radiusServer.on("error", (err) => {
  console.error("RADIUS server error:", err);
});

radiusServer.bind(1812, "0.0.0.0");



app.listen(8000, () => console.log("Backend running on port 8000"));