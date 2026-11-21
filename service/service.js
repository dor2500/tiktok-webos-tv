const Service = require("webos-service");
const https = require("https");
const http = require("http");
const os = require("os");

const service = new Service("com.dorp.tiktok.tv.service");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PAIRING_PORT = 8787;
let pairingServer = null;
let pairingState = {
  active: false,
  pin: "",
  paired: false,
  account: null
};

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info && info.family === "IPv4" && !info.internal) {
        return info.address;
      }
    }
  }
  return "192.168.1.5";
}

function fetchText(url, sessionid, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.tiktok.com/"
    };
    if (sessionid) {
      headers.Cookie = "sessionid=" + sessionid + ";";
    }

    const req = https.get(url, { headers }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        const nextUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : "https://www.tiktok.com" + res.headers.location;
        res.resume();
        fetchText(nextUrl, sessionid, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error("HTTP " + res.statusCode));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    });
    req.setTimeout(10000, () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
  });
}

function extractUniversalData(html) {
  const marker = "__UNIVERSAL_DATA_FOR_REHYDRATION__";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf(">", idx);
  if (start === -1) return null;
  const end = html.indexOf("</script>", start + 1);
  if (end === -1) return null;
  try {
    return JSON.parse(html.slice(start + 1, end));
  } catch (e) {
    return null;
  }
}

function mapVideoItem(it) {
  return {
    id: String(it.id || ""),
    desc: String(it.desc || ""),
    playAddr: String((it.video && it.video.playAddr) || ""),
    cover: String((it.video && (it.video.cover || it.video.originCover)) || ""),
    duration: Number((it.video && it.video.duration) || 0),
    author: {
      uniqueId: String((it.author && it.author.uniqueId) || "tiktok"),
      nickname: String((it.author && it.author.nickname) || "TikTok Creator"),
      avatar: String((it.author && (it.author.avatarThumb || it.author.avatarMedium)) || ""),
      verified: Boolean(it.author && it.author.verified)
    },
    music: {
      title: String((it.music && it.music.title) || "Original Sound"),
      author: String((it.music && it.music.authorName) || "")
    },
    stats: {
      diggCount: Number((it.stats && it.stats.diggCount) || 0),
      commentCount: Number((it.stats && it.stats.commentCount) || 0),
      shareCount: Number((it.stats && it.stats.shareCount) || 0),
      collectCount: Number((it.stats && it.stats.collectCount) || 0)
    }
  };
}

async function fetchBatch(targetCount, tab, sessionid) {
  const seen = new Set();
  const collected = [];
  const maxAttempts = Math.min(4, Math.max(2, targetCount));
  const targetUrl =
    tab === "following" && sessionid
      ? "https://www.tiktok.com/following"
      : "https://www.tiktok.com/foryou";

  for (let i = 0; i < maxAttempts && collected.length < targetCount; i++) {
    const html = await fetchText(targetUrl, sessionid, 3);
    const data = extractUniversalData(html);
    if (!data) continue;
    const scope = data["__DEFAULT_SCOPE__"] || {};
    const fy = scope["webapp.foryou.video"] || scope["webapp.following.video"] || {};
    const rawList = Array.isArray(fy.itemList) ? fy.itemList : [];
    for (const it of rawList) {
      if (it && it.video && it.video.playAddr) {
        const mapped = mapVideoItem(it);
        if (mapped.id && !seen.has(mapped.id)) {
          seen.add(mapped.id);
          collected.push(mapped);
        }
      }
    }
  }
  return collected;
}

async function fetchUserProfile(username, sessionid) {
  const clean = String(username || "").replace(/^@+/, "").trim();
  if (!clean) throw new Error("Username is required");
  const html = await fetchText("https://www.tiktok.com/@" + encodeURIComponent(clean), sessionid, 3);
  const data = extractUniversalData(html);
  const scope = (data && data["__DEFAULT_SCOPE__"]) || {};
  const detail = scope["webapp.user-detail"] || {};
  const userInfo = detail.userInfo || {};
  const user = userInfo.user || {};
  const stats = userInfo.stats || {};

  if (!user.uniqueId) {
    return {
      uniqueId: clean,
      nickname: "@" + clean,
      avatar: "",
      signature: "Connected TikTok account",
      verified: false,
      stats: {
        followingCount: 0,
        followerCount: 0,
        heartCount: 0,
        videoCount: 0
      }
    };
  }

  return {
    uniqueId: String(user.uniqueId || clean),
    nickname: String(user.nickname || clean),
    avatar: String(user.avatarLarger || user.avatarMedium || user.avatarThumb || ""),
    signature: String(user.signature || ""),
    verified: Boolean(user.verified),
    stats: {
      followingCount: Number(stats.followingCount || 0),
      followerCount: Number(stats.followerCount || 0),
      heartCount: Number(stats.heartCount || 0),
      videoCount: Number(stats.videoCount || 0)
    }
  };
}

async function fetchComments(videoId, sessionid) {
  const url =
    "https://www.tiktok.com/api/comment/list/?aweme_id=" +
    encodeURIComponent(videoId) +
    "&count=20&cursor=0";
  const raw = await fetchText(url, sessionid, 2);
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed.comments) ? parsed.comments : [];
  return list.map((c) => ({
    cid: String(c.cid || ""),
    text: String(c.text || ""),
    likes: Number(c.digg_count || 0),
    user: {
      uniqueId: String((c.user && c.user.unique_id) || "user"),
      nickname: String((c.user && c.user.nickname) || "TikTok User"),
      avatar: String(
        (c.user && c.user.avatar_thumb && c.user.avatar_thumb.url_list && c.user.avatar_thumb.url_list[0]) || ""
      )
    }
  }));
}

function buildPairingHtml(pin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Pair TikTok TV</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0a0a0e; color: #fff; padding: 24px; }
  .card { max-width: 440px; margin: 20px auto; background: #15151d; border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { color: #a1a7b3; font-size: 14px; line-height: 1.5; margin: 0 0 18px; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #d6dbe4; }
  input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.18); background: #0d0d12; color: #fff; font-size: 15px; margin-bottom: 16px; }
  button { width: 100%; padding: 14px; border-radius: 12px; border: none; background: #fe2c55; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
  .msg { margin-top: 14px; font-size: 14px; text-align: center; }
  .ok { color: #25f4ee; }
  .err { color: #ff6b81; }
</style>
</head>
<body>
  <div class="card">
    <h1>Connect TikTok to LG TV</h1>
    <p>Enter the 4-digit PIN shown on your TV and your TikTok username. Optionally paste your <code>sessionid</code> cookie from <b>tiktok.com</b> for personalized For You &amp; Following feeds.</p>
    <form id="f">
      <label>TV Pairing PIN</label>
      <input id="pin" type="text" inputmode="numeric" maxlength="4" placeholder="e.g. ${pin}" required />
      <label>TikTok @username</label>
      <input id="user" type="text" placeholder="@yourhandle" required />
      <label>Session ID Cookie (Optional)</label>
      <input id="sid" type="password" placeholder="sessionid from tiktok.com cookies" />
      <button type="submit">Connect to TV</button>
    </form>
    <div id="msg" class="msg"></div>
  </div>
  <script>
    document.getElementById("f").addEventListener("submit", async function(e) {
      e.preventDefault();
      const msg = document.getElementById("msg");
      msg.textContent = "Connecting...";
      msg.className = "msg";
      const r = await fetch("/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: document.getElementById("pin").value.trim(),
          username: document.getElementById("user").value.trim(),
          sessionid: document.getElementById("sid").value.trim()
        })
      });
      const j = await r.json();
      if (j.ok) {
        msg.textContent = "Connected! Check your TV screen.";
        msg.className = "msg ok";
      } else {
        msg.textContent = j.error || "Invalid PIN";
        msg.className = "msg err";
      }
    });
  </script>
</body>
</html>`;
}

function stopPairingServer() {
  if (pairingServer) {
    try {
      pairingServer.close();
    } catch (e) {}
    pairingServer = null;
  }
  pairingState.active = false;
}

service.register("getFeed", (message) => {
  const payload = message.payload || {};
  const count = Math.min(8, Math.max(2, Number(payload.count || 4)));
  const tab = payload.tab === "following" ? "following" : "foryou";
  const sessionid = String(payload.sessionid || "");

  fetchBatch(count, tab, sessionid)
    .then((items) => message.respond({ returnValue: true, items }))
    .catch((err) =>
      message.respond({
        returnValue: false,
        errorText: (err && err.message) || "Failed to load TikTok feed"
      })
    );
});

service.register("getProfile", (message) => {
  const payload = message.payload || {};
  fetchUserProfile(payload.username, String(payload.sessionid || ""))
    .then((profile) => message.respond({ returnValue: true, profile }))
    .catch((err) =>
      message.respond({
        returnValue: false,
        errorText: (err && err.message) || "Failed to load profile"
      })
    );
});

service.register("getComments", (message) => {
  const payload = message.payload || {};
  fetchComments(String(payload.videoId || ""), String(payload.sessionid || ""))
    .then((comments) => message.respond({ returnValue: true, comments }))
    .catch((err) =>
      message.respond({
        returnValue: false,
        errorText: (err && err.message) || "Comments unavailable"
      })
    );
});

service.register("startPairing", (message) => {
  stopPairingServer();
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  pairingState = { active: true, pin, paired: false, account: null };

  pairingServer = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildPairingHtml(pin));
      return;
    }
    if (req.method === "POST" && req.url === "/pair") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          if (String(data.pin || "").trim() !== pairingState.pin) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Incorrect PIN" }));
            return;
          }
          const username = String(data.username || "").replace(/^@+/, "").trim();
          if (!username) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Username required" }));
            return;
          }
          pairingState.paired = true;
          pairingState.account = {
            username,
            sessionid: String(data.sessionid || "").trim()
          };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Invalid request" }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  pairingServer.listen(PAIRING_PORT, "0.0.0.0", () => {
    const ip = getLanIp();
    message.respond({
      returnValue: true,
      url: "http://" + ip + ":" + PAIRING_PORT,
      pin
    });
  });

  pairingServer.on("error", (err) => {
    message.respond({
      returnValue: false,
      errorText: (err && err.message) || "Failed to start pairing server"
    });
  });
});

service.register("getPairingStatus", (message) => {
  if (pairingState.paired && pairingState.account) {
    const acc = pairingState.account;
    stopPairingServer();
    message.respond({ returnValue: true, paired: true, account: acc });
    return;
  }
  message.respond({ returnValue: true, paired: false });
});

service.register("stopPairing", (message) => {
  stopPairingServer();
  message.respond({ returnValue: true });
});
