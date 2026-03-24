const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");
const http = require("http");

// ===== CONFIG =====
const EMAIL_USER = "verysafectfmail@gmail.com";
const EMAIL_PASS = "crqj mpqi eiqq ugrc";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:4040/api/tunnels", (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const httpsTunnel = json.tunnels.find(
            (t) => t.public_url && t.public_url.startsWith("https://")
          );

          if (!httpsTunnel) {
            return reject(new Error("No HTTPS ngrok tunnel found. Is ngrok running?"));
          }

          resolve(httpsTunnel.public_url);
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

async function sendReply(to, subject) {
  const url = await getNgrokUrl();

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: `"CTF Bot" <${EMAIL_USER}>`,
    to,
    subject: `Re: ${subject}`,
    text: `Hello,

Here is your access link:
${url}

Good luck.`
  });

  console.log("Replied to:", to);
}

function shouldIgnore(from, subject) {
  const sender = (from || "").toLowerCase();
  const sub = (subject || "").toLowerCase();

  if (!sender) return true;
  if (sender.includes("no-reply")) return true;
  if (sender.includes("google.com")) return true;
  if (sender.includes("instagram.com")) return true;

  // Uncomment this if you only want replies to a keyword
  // if (!sub.includes("unlock")) return true;

  return false;
}

async function processUnread(client) {
  await client.noop();

  const unseen = await client.search({ seen: false });

  if (!unseen.length) {
    console.log("No unread mail.");
    return;
  }

  for (const seq of unseen) {
    const message = await client.fetchOne(seq, {
      source: true,
      flags: true,
      uid: true
    });

    if (!message) continue;
    if (message.flags.has("\\Seen")) continue;

    const parsed = await simpleParser(message.source);
    const from = parsed.from?.value?.[0]?.address || "";
    const subject = parsed.subject || "CTF Request";

    console.log("Unread mail from:", from, "| subject:", subject);

    if (shouldIgnore(from, subject)) {
      console.log("Ignored:", from);
      await client.messageFlagsAdd(message.uid, ["\\Seen"]);
      continue;
    }

    try {
      await sendReply(from, subject);
      await client.messageFlagsAdd(message.uid, ["\\Seen"]);
    } catch (err) {
      console.error("Reply failed:", err.message);
    }
  }
}

async function main() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    logger: false
  });

  await client.connect();
  await client.mailboxOpen("INBOX");

  console.log("Mail bot running...");

  while (true) {
    try {
      await processUnread(client);
    } catch (err) {
      console.error("Processing error:", err.message);

      try {
        await client.mailboxOpen("INBOX");
      } catch {}
    }

    await sleep(5000);
  }
}

main().catch(console.error);