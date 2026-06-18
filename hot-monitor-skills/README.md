# 极客雷达 · Agent Skills

将热点监控能力封装为完全自包含的 Claude Code Agent Skill。

**无需启动任何本地服务 · 无必填 API Key · 安装即用**

---

## 使用方式

| 命令 | 模式 | 说明 |
|------|------|------|
| `/hot-monitor <关键词>` | Scan | 立即搜索该关键词的最新热点，AI 验证相关性后输出命中内容 |
| `/hot-monitor` 或 `/hot-monitor digest [N]` | Digest | 今日 AI/科技热点日报（默认过去 24 小时） |
| `/hot-monitor watch <关键词>` | Watch | 关键词深度分析：生成扩展词 + 搜索 + 监控策略建议 |

---

## 安装方法

### 安装到当前项目

```bash
npx skills add ./hot-monitor-skills/hot-monitor -y
```

### 安装到全局（所有项目可用）

```bash
npx skills add ./hot-monitor-skills/hot-monitor -g -y
```

安装后在 Claude Code 中直接使用 `/hot-monitor` 即可。

---

## 可选增强（非必填）

| 环境变量 | 用途 | 获取方式 |
|----------|------|----------|
| `SERPER_API_KEY` | 增加 Google News 搜索（初始免费 2500 次） | [serper.dev](https://serper.dev) |

无此 Key 时，Skill 仍可正常工作，仅从 HackerNews（免费）搜索。

---

## 目录结构

```
hot-monitor-skills/
├── hot-monitor/
│   └── SKILL.md          ← 技能主文件（三种模式统一入口）
├── references/
│   ├── search-sources.md ← 各搜索源 API 文档
│   └── relevance-guide.md← 宁缺毋滥相关性判断准则
└── scripts/
    ├── search_china.py   ← B 站 + 微博搜索脚本（可选增强）
    └── requirements.txt
```

---

## 设计原则

- **完全自包含**：不依赖本地 server、不需要数据库，AI 本身就是处理引擎
- **宁缺毋滥**：相关性验证由 AI 直接判断，严格过滤「顺带提及」的误报
- **无状态**：每次调用独立执行，不存储历史记录
- **单一入口**：一个 `/hot-monitor` 命令覆盖所有使用场景
