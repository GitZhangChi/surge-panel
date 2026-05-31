/**
 * 出口体检面板 (IP 纯净度 + 归属 + 住宅判定 + 流媒体/AI 解锁)
 * Surge Panel script. 由 ip-health.sgmodule 挂载。
 * 数据源: ip-api.com (geo/ASN/hosting/proxy/mobile 安全字段, 免费档即可)
 */

const TIMEOUT = 5; // 秒

function httpGet(url, headers) {
  return new Promise((resolve) => {
    $httpClient.get({ url, headers: headers || {}, timeout: TIMEOUT }, (err, resp, data) => {
      if (err || !resp) return resolve({ ok: false, status: 0, data: '' });
      resolve({ ok: true, status: resp.status, data: data || '', headers: resp.headers || {} });
    });
  });
}

// ── 国旗 emoji from countryCode ──
function flag(cc) {
  if (!cc || cc.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

// ── IP 归属 + 类型 + 风险 ──
async function getIPInfo() {
  const fields = 'status,message,query,country,countryCode,regionName,city,isp,org,as,asname,mobile,proxy,hosting';
  let r = await httpGet(`http://ip-api.com/json/?fields=${fields}&lang=en`);
  try {
    const j = JSON.parse(r.data);
    if (j && j.status === 'success') return j;
  } catch (e) {}
  // 兜底: ipinfo (仅 geo, 无安全字段)
  r = await httpGet('https://ipinfo.io/json');
  try {
    const j = JSON.parse(r.data);
    if (j && j.ip) {
      return {
        status: 'success', query: j.ip, country: j.country, countryCode: j.country,
        regionName: j.region, city: j.city, isp: (j.org || '').replace(/^AS\d+\s*/, ''),
        as: (j.org || '').match(/^AS\d+/)?.[0] || '', asname: '',
        mobile: false, proxy: false, hosting: undefined,
      };
    }
  } catch (e) {}
  return null;
}

function ipType(info) {
  if (!info) return ['❓', '未知'];
  if (info.mobile) return ['📱', '蜂窝 / 移动网络'];
  if (info.proxy) return ['🕵️', '代理 / VPN 出口'];
  if (info.hosting === true) return ['🏢', '机房 IDC'];
  if (info.hosting === false) return ['🏠', '住宅 / 商宽'];
  return ['🌐', '数据中心(推测)'];
}

function ipRisk(info) {
  if (!info) return ['❓', '检测失败', 'error'];
  if (info.proxy) return ['🚨', '已被标记为代理', 'alert'];
  if (info.hosting === true) return ['⚠️', '机房 IP(易触风控)', 'warning'];
  if (info.mobile) return ['✅', '蜂窝 · 较干净', 'good'];
  if (info.hosting === false) return ['✅', '纯净 · 非代理非 IDC', 'good'];
  return ['➖', '未知(兜底源)', 'info'];
}

// ── 流媒体 / AI 解锁 ──
async function netflixRegion() {
  const r = await httpGet('https://www.netflix.com/');
  const b = r.data || '';
  const m =
    /"requestCountry":\{"id":"([A-Z]{2})"/.exec(b) ||
    /"countryCode":"([A-Z]{2})"/.exec(b) ||
    /data-country="([A-Z]{2})"/.exec(b);
  return m ? m[1] : null;
}
async function checkNetflix() {
  const r = await httpGet('https://www.netflix.com/title/81280792');
  if (r.status === 404) return '🟡 仅自制剧';
  if (r.status === 403) return '❌ 不支持';
  if (r.status !== 200) return '❓ 检测失败';
  const reg = await netflixRegion();
  return `✅ 完整解锁${reg ? ` (${reg})` : ''}`;
}

async function checkMax() {
  // 只认状态码: max.com 的 JS bundle 即使可访问也内嵌 "not available" 文案, 不能 grep body
  const r = await httpGet('https://www.max.com/');
  if (r.status === 403 || r.status === 451) return '❌ 不支持';
  if (r.status === 0) return '❓ 检测失败';
  if (r.status >= 200 && r.status < 400) return '✅ 可访问';
  return '🟡 受限';
}

const AI_BLOCK = ['CN', 'HK', 'RU', 'IR', 'KP', 'CU', 'SY', 'VE'];
async function traceLoc(host) {
  const r = await httpGet(`https://${host}/cdn-cgi/trace`);
  const m = /loc=([A-Z]{2})/.exec(r.data || '');
  return m ? m[1] : null;
}
async function checkChatGPT() {
  const loc = await traceLoc('chatgpt.com');
  if (!loc) return '❓ 检测失败';
  if (AI_BLOCK.includes(loc)) return `❌ 不支持 (${loc})`;
  return `✅ 支持 (${loc})`;
}
async function checkClaude() {
  const loc = await traceLoc('claude.ai');
  if (!loc) return '❓ 检测失败';
  if (AI_BLOCK.includes(loc)) return `❌ 不支持 (${loc})`;
  return `✅ 支持 (${loc})`;
}

// ── 排版 ──
function padLabel(s, n) {
  // 拉丁标签右补空格至 n 列(等宽字体下对齐)
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) > 0x2e7f ? 2 : 1;
  return s + ' '.repeat(Math.max(0, n - w));
}

(async () => {
  const [info, nf, mx, gpt, cl] = await Promise.all([
    getIPInfo(), checkNetflix(), checkMax(), checkChatGPT(), checkClaude(),
  ]);

  const cc = info ? info.countryCode : '';
  const fg = flag(cc);
  const where = info
    ? `${fg} ${info.country || cc}${info.city ? ' · ' + info.city : ''}`
    : '查询失败';
  // ip-api 的 as 字段已含「ASxxxx 机构名」, 不要再拼 asname(那是注册局 handle, 冗余)
  let net = info ? (info.as || info.isp || '—').trim() : '—';
  net = net.replace(/^(AS\d+)\s+/, '$1 · '); // AS25820 IT7 Networks → AS25820 · IT7 Networks
  if (net.length > 34) net = net.slice(0, 33).trimEnd() + '…';
  const [tIcon, tText] = ipType(info);
  const [rIcon, rText, rLevel] = ipRisk(info);

  const lines = [
    `归属  ${where}`,
    `网络  ${net}`,
    `类型  ${tIcon} ${tText}`,
    `风险  ${rIcon} ${rText}`,
    `━━━━━━━━━━━━━━━━`,
    `${padLabel('Netflix', 10)}${nf}`,
    `${padLabel('Max(HBO)', 10)}${mx}`,
    `${padLabel('ChatGPT', 10)}${gpt}`,
    `${padLabel('Claude', 10)}${cl}`,
  ];

  // 整体健康度 → 图标颜色
  const unlockBad = [nf, mx, gpt, cl].some((s) => s.startsWith('❌'));
  let icon = 'checkmark.seal.fill', color = '#34C759'; // 绿
  if (rLevel === 'warning' || unlockBad) { icon = 'exclamationmark.shield.fill'; color = '#FF9F0A'; } // 橙
  if (rLevel === 'alert' || rLevel === 'error') { icon = 'xmark.shield.fill'; color = '#FF3B30'; } // 红

  $done({
    title: `出口体检 · ${fg} ${cc || '??'}`,
    content: lines.join('\n'),
    icon,
    'icon-color': color,
  });
})();
