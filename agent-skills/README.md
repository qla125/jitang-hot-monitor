# 极客雷达 · Agent Skills

将热点监控能力封装为完全自包含的 Claude Code Agent Skills。

**无需启动任何本地服务 · 无必填 API Key · 安装即用**

---

## 技能列表

| 命令 | 用途 |
|------|------|
| `/hot-scan <关键词>` | 立即搜索某个关键词的最新热点，AI 验证相关性后输出命中内容 |
| `/hot-digest [小时数]` | 今日 AI/科技热点日报（默认过去 24 小时，可传 48 等） |
| `/hot-watch <关键词>` | 关键词深度分析：生成扩展词 + 搜索 + 监控策略建议 |

---

## 安装方法

### 方式一：安装到当前项目

```bash
npx skills add ./agent-skills/hot-scan -y
npx skills add ./agent-skills/hot-digest -y
npx skills add ./agent-skills/hot-watch -y
```

### 方式二：安装到全局（所有项目可用）

```bash
npx skills add ./agent-skills/hot-scan -g -y
npx skills add ./agent-skills/hot-digest -g -y
npx skills add ./agent-skills/hot-watch -g -y
```

安装后在 Claude Code 中直接使用 `/hot-scan`、`/hot-digest`、`/hot-watch` 即可。

---

## 可选增强（非必填）

配置以下环境变量可扩展搜索源：

| 环境变量 | 用途 | 获取方式 |
|----------|------|----------|
| `SERPER_API_KEY` | 增加 Google News 搜索（初始免费 2500 次） | [serper.dev](https://serper.dev) |

无此 Key 时，Skills 仍可正常工作，仅从 HackerNews（免费）搜索。

---

## 设计原则

- **完全自包含**：不依赖本地 server、不需要数据库，AI 本身就是处理引擎
- **宁缺毋滥**：相关性验证由 AI 直接判断，严格过滤「顺带提及」的误报
- **无状态**：每次调用独立执行，不存储历史记录
- **可组合**：三个技能互相配合，`/hot-watch` → `/hot-scan` → `/hot-digest` 形成完整工作流
