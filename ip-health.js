/**
 * 节点状态面板 (IP 归属 + 网络属性 + 流媒体/AI 可用性)
 * Surge Panel script. 由 ip-health.sgmodule 挂载。
 * 数据源: ip-api.com (geo/ASN/hosting/proxy/mobile 安全字段, 免费档即可)
 */

const TIMEOUT = 5; // 秒

function httpGet(url, headers) {
  return new Promise((resolve) => {
    const mergedHeaders = Object.assign({
      'User-Agent': 'Mozilla/5.0 (Surge Panel; IPHealth)',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    }, headers || {});
    $httpClient.get({ url, headers: mergedHeaders, timeout: TIMEOUT }, (err, resp, data) => {
      if (err || !resp) return resolve({ ok: false, status: 0, data: '' });
      resolve({ ok: true, status: Number(resp.status) || 0, data: data || '', headers: resp.headers || {} });
    });
  });
}

// ── 国旗 emoji from countryCode ──
function flag(cc) {
  if (!cc || cc.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
}

// ── IP 归属 + 属性 + 信誉 ──
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
  if (info.mobile) return ['📱', '蜂窝网络'];
  if (info.proxy) return ['🕵️', '代理 / VPN'];
  if (info.hosting === true) return ['🏢', 'IDC / 机房'];
  if (info.hosting === false) return ['🏠', '住宅 / 商宽'];
  return ['🌐', '未知网络'];
}

function ipRisk(info) {
  if (!info) return ['❓', '检测失败', 'error'];
  if (info.proxy) return ['🚨', '代理标记', 'alert'];
  if (info.hosting === true) return ['⚠️', 'IDC · 风控较高', 'warning'];
  if (info.mobile) return ['✅', '蜂窝 · 较干净', 'good'];
  if (info.hosting === false) return ['✅', '住宅 · 较干净', 'good'];
  return ['➖', '数据不足', 'info'];
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

// HBO Max 官方可用地区, 来源: https://help.hbomax.com/us/Answer/Detail/000002518
// 日本等未开放地区也可能返回 200 首页, 不能用状态码当成解锁结果。
const MAX_SUPPORTED = new Set([
  'US', 'AS', 'GU', 'MP', 'PR', 'VI',
  'AI', 'AG', 'AR', 'AW', 'BS', 'BB', 'BZ', 'BO', 'BR', 'VG', 'KY', 'CL', 'CO', 'CR', 'CW',
  'DM', 'DO', 'EC', 'SV', 'GD', 'GT', 'GY', 'HT', 'HN', 'JM', 'MX', 'MS', 'NI', 'PA', 'PY',
  'PE', 'KN', 'LC', 'VC', 'SR', 'TT', 'TC', 'UY', 'VE',
  'AL', 'AD', 'AM', 'AT', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GE',
  'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'KZ', 'KG', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'ME',
  'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'TJ', 'TR', 'UA',
  'GB',
  'AU', 'BD', 'BT', 'BN', 'KH', 'FJ', 'HK', 'ID', 'KI', 'LA', 'MO', 'MY', 'MV', 'MH', 'FM',
  'MN', 'MM', 'NR', 'NP', 'NU', 'PK', 'PW', 'PG', 'PH', 'WS', 'SG', 'SB', 'LK', 'TW', 'TH',
  'TL', 'TO', 'TV', 'VU',
]);
const MAX_SUPPORTED_FROM_20260616 = new Set(['NZ', 'CK', 'TK', 'VN']);

function maxSupportedCountry(cc) {
  if (!cc) return false;
  if (MAX_SUPPORTED.has(cc)) return true;
  return new Date() >= new Date('2026-06-16T00:00:00Z') && MAX_SUPPORTED_FROM_20260616.has(cc);
}

function parseMaxCountry(body) {
  const b = body || '';
  const m =
    /"userCountry"\s*:\s*"([A-Z]{2})"/.exec(b) ||
    /userCountry:\s*'([A-Z]{2})'/.exec(b) ||
    /"countryCode"\s*:\s*"([a-z]{2})"/.exec(b);
  return m ? m[1].toUpperCase() : null;
}

async function checkMax(fallbackCountryCode) {
  const r = await httpGet('https://www.max.com/');
  if (r.status === 403 || r.status === 451) return '❌ 不支持';
  if (r.status === 0) return '❓ 检测失败';
  const cc = parseMaxCountry(r.data) || fallbackCountryCode || null;
  if (cc && !maxSupportedCountry(cc)) return `❌ 未开放 (${cc})`;
  if (r.status >= 200 && r.status < 400) return cc ? `✅ 支持 (${cc})` : '🟡 可访问(地区未知)';
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
  const infoPromise = getIPInfo();
  const [info, nf, gpt, cl] = await Promise.all([
    infoPromise, checkNetflix(), checkChatGPT(), checkClaude(),
  ]);
  const mx = await checkMax(info ? info.countryCode : null);

  const cc = info ? info.countryCode : '';
  const fg = flag(cc);
  const where = info
    ? `${fg} ${info.country || cc}${info.city ? ' · ' + info.city : ''}`
    : '查询失败';
  // ip-api 的 as 字段已含「ASxxxx 机构名」, 不要再拼 asname(那是注册局 handle, 冗余)
  let net = info ? (info.as || info.isp || '—').trim() : '—';
  // 去掉公司法律后缀(Corporation/Inc/LLC…), 对判断没用且占地方
  net = net.replace(
    /[,\s]+(Corporation|Corp|Incorporated|Inc|L\.?L\.?C|Ltd|Limited|Co|Company|GmbH|Holdings?|Group)\.?$/gi,
    ''
  );
  net = net.replace(/^(AS\d+)\s+/, '$1 · '); // AS21743 Atlas Networks → AS21743 · Atlas Networks
  if (net.length > 26) net = net.slice(0, 25).trimEnd() + '…';
  const [tIcon, tText] = ipType(info);
  const [rIcon, rText, rLevel] = ipRisk(info);

  const lines = [
    `地区  ${where}`,
    `ASN   ${net}`,
    `属性  ${tIcon} ${tText}`,
    `信誉  ${rIcon} ${rText}`,
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
    title: `节点状态 · ${fg} ${cc || '??'}`,
    content: lines.join('\n'),
    icon,
    'icon-color': color,
  });
})();
