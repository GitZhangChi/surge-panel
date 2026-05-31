# surge-panel

Surge 面板:**出口体检** —— 当前出口的 IP 归属 / ASN / 住宅判定 / 风险纯净度 + Netflix·Max·ChatGPT·Claude 解锁,三端通用 (macOS / iOS / tvOS)。

## 安装

Surge → Modules → Install Module from URL:

```
https://raw.githubusercontent.com/GitZhangChi/surge-panel/main/ip-health.sgmodule
```

装好后面板出现在菜单 **Panels**。点击面板即刷新(默认 10 分钟自动刷一次)。

## 字段说明

- **类型**:🏠 住宅/商宽 · 🏢 机房 IDC · 📱 蜂窝 · 🕵️ 代理/VPN —— 取自 ip-api.com 的 hosting/mobile/proxy 安全字段
- **风险**:住宅=绿(纯净)/ 机房=橙 / 被标记代理=红,左侧盾牌图标颜色同步
- **Netflix**:带片源区域,区域 ≠ 出口 IP 国家时说明 DNS/分流把 Netflix 带偏了
