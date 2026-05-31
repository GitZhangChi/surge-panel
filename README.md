# surge-panel

Surge 面板:**节点状态** —— 当前节点的 IP 归属 / ASN / 网络属性 / 信誉状态,以及 Netflix·Max·ChatGPT·Claude 可用性,三端通用 (macOS / iOS / tvOS)。

## 安装

Surge → Modules → Install Module from URL:

```
https://raw.githubusercontent.com/GitZhangChi/surge-panel/main/ip-health.sgmodule
```

装好后面板出现在菜单 **Panels**。点击面板即刷新(默认 10 分钟自动刷一次)。

## 字段说明

- **属性**:🏠 住宅/商宽 · 🏢 IDC/机房 · 📱 蜂窝 · 🕵️ 代理/VPN —— 取自 ip-api.com 的 hosting/mobile/proxy 安全字段
- **信誉**:住宅/蜂窝=绿,IDC=橙,代理标记=红,左侧盾牌图标颜色同步
- **Netflix**:带片源区域,区域 ≠ 出口 IP 国家时说明 DNS/分流把 Netflix 带偏了
- **Max(HBO)**:按 HBO Max 官方可用国家/地区判断,不再把“首页能打开”误判成已解锁；例如日本出口会显示未开放
