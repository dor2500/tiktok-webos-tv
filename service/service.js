const Service = require("webos-service");
const https = require("https");

const service = new Service("com.dorp.tiktok.tv.service");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function fetchText(url, redirectsLeft) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        }
      },
      (res) => {
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
          fetchText(nextUrl, redirectsLeft - 1).then(resolve, reject);
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
      }
    );
    req.setTimeout(10000, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.on("error", reject);
  });
}

function parseUniversalItems(html) {
  const marker = "__UNIVERSAL_DATA_FOR_REHYDRATION__";
  const idx = html.indexOf(marker);
  if (idx === -1) return [];
  const start = html.indexOf(">", idx);
  if (start === -1) return [];
  const end = html.indexOf("</script>", start + 1);
  if (end === -1) return [];

  const json = JSON.parse(html.slice(start + 1, end));
  const scope = json["__DEFAULT_SCOPE__"] || {};
  const fy = scope["webapp.foryou.video"] || {};
  const rawList = Array.isArray(fy.itemList) ? fy.itemList : [];

  return rawList
    .filter((it) => it && it.video && it.video.playAddr)
    .map((it) => ({
      id: String(it.id || ""),
      desc: String(it.desc || ""),
      playAddr: String(it.video.playAddr || ""),
      cover: String(it.video.cover || it.video.originCover || ""),
      duration: Number(it.video.duration || 0),
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
    }));
}

async function fetchBatch(targetCount) {
  const seen = new Set();
  const collected = [];
  const maxAttempts = Math.min(4, Math.max(2, targetCount));

  for (let i = 0; i < maxAttempts && collected.length < targetCount; i++) {
    const html = await fetchText("https://www.tiktok.com/foryou", 3);
    const items = parseUniversalItems(html);
    for (const item of items) {
      if (item.id && !seen.has(item.id)) {
        seen.add(item.id);
        collected.push(item);
      }
    }
  }
  return collected;
}

service.register("getFeed", (message) => {
  const count = Math.min(8, Math.max(2, Number((message.payload && message.payload.count) || 4)));
  fetchBatch(count)
    .then((items) => {
      message.respond({
        returnValue: true,
        items
      });
    })
    .catch((err) => {
      message.respond({
        returnValue: false,
        errorText: err && err.message ? err.message : "Failed to load TikTok feed"
      });
    });
});
