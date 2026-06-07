/**
 * verifyKeywordMatch 准确率评估脚本
 *
 * 背景：相关性判断是 AI 输出的一段话，不像数据一样能精确比对，每次调整 prompt
 * 后很难快速判断是变好还是变坏。本脚本提供一份手工标注的"金标准"测试集
 * （重点覆盖容易让 AI 误判为相关的假阳性陷阱），批量跑一遍 verifyKeywordMatch，
 * 输出准确率与误判样本，方便后续快速迭代 prompt。
 *
 * 运行: cd server && npx tsx src/scripts/eval-keyword-match.ts
 */
import 'dotenv/config';
import { verifyKeywordMatch, type KeywordVerifyResult } from '../services/ai';

interface TestCase {
  keyword: string;
  content: string;
  expected: boolean;
  notes: string;
}

const TEST_CASES: TestCase[] = [
  // ── 真阳性：内容确实围绕关键词展开 ──
  {
    keyword: 'Claude Sonnet 4.6',
    content:
      'Anthropic 今日发布 Claude Sonnet 4.6，相比上一代在代码生成与长上下文理解上有显著提升，官方宣称其在 SWE-bench 上的得分超过此前所有版本。开发者可通过 API 直接调用该模型。',
    expected: true,
    notes: '通篇围绕该模型的发布与性能展开',
  },
  {
    keyword: '鱼皮的 AI 导航',
    content:
      '程序员鱼皮在视频中详细介绍了他开发的 AI 导航网站，收录了上百个好用的 AI 工具，并演示了如何快速找到适合自己的编程辅助工具。',
    expected: true,
    notes: '语义相关但未逐字出现关键词原文，应识别为同一话题（验证 AI 不依赖字面匹配）',
  },

  // ── 假阳性陷阱：列表/对比中顺带提及 ──
  {
    keyword: 'Claude Sonnet 4.6',
    content:
      'OpenAI 今天发布了 GPT-5.5，号称在推理能力上大幅超越 Claude Sonnet 4.6 和 Gemini 2.5 Pro。文章详细介绍了 GPT-5.5 的架构改进与基准测试成绩，并采访了 OpenAI 的研究员。',
    expected: false,
    notes: '核心主体是 GPT-5.5，Claude Sonnet 4.6 只是对比中被提及一次（用户报告的真实场景）',
  },
  {
    keyword: 'Claude Sonnet 4.6',
    content:
      '2026 年值得关注的十大 AI 模型盘点：1. GPT-5.5 2. Gemini 3.0 3. Claude Sonnet 4.6 4. Llama 5 …… 本文将逐一分析每个模型的特点和适用场景，重点篇幅集中在 GPT-5.5 和国产大模型上。',
    expected: false,
    notes: '盘点列表中的一项，并非正文重点讨论对象',
  },

  // ── 假阳性陷阱：标题党 / 文不对题 ──
  {
    keyword: 'Claude Sonnet 4.6',
    content:
      '【重磅】Claude Sonnet 4.6 要来了？知情人士透露的最新消息是……其实只是某网友的一句猜测性转发，正文通篇讨论的是另一家公司即将举办的发布会，与该模型本身毫无关系。',
    expected: false,
    notes: '标题党，正文与关键词无实质关联',
  },

  // ── 假阳性陷阱：同系列不同版本 ──
  {
    keyword: 'Claude Sonnet 4.6',
    content:
      'Anthropic 发布 Claude Opus 4.5，专注于复杂推理与代理任务，本文详细测评了其在多步骤任务中的表现，并与上一代 Opus 模型进行了对比。',
    expected: false,
    notes: '同公司同系列但具体版本不同，不应仅凭"Claude/Anthropic"泛化匹配',
  },

  // ── 假阳性陷阱：背景信息式提及 ──
  {
    keyword: 'AI 编程工具',
    content:
      '小明今天分享了他用 Cursor 写代码的心得，顺带提了一句"市面上的 AI 编程工具很多，我试过十几个"，但全文主要在讲他个人的编码习惯和效率技巧，没有展开介绍任何具体工具。',
    expected: false,
    notes: '关键词只是背景式带过，正文核心是个人心得而非工具介绍',
  },

  // ── 真阴性：完全无关 ──
  {
    keyword: 'Claude Sonnet 4.6',
    content: '今日体育新闻：某球队在昨晚的比赛中以 3:1 战胜对手，球迷们在社交媒体上热议比赛精彩瞬间。',
    expected: false,
    notes: '完全无关领域',
  },

  // ── 真阳性：英文内容 ──
  {
    keyword: 'GPT-5',
    content:
      'OpenAI officially announced GPT-5 today, claiming major improvements in reasoning, multimodal understanding, and coding benchmarks. The model will be rolled out to ChatGPT Plus subscribers first.',
    expected: true,
    notes: '英文内容，通篇围绕关键词产品的发布展开',
  },

  // ── 人物/账号类关键词 ──
  {
    keyword: '李一舟',
    content: '近期，知名 AI 培训博主李一舟因课程内容争议被多家媒体报道，本文梳理了事件始末以及他本人的最新回应。',
    expected: true,
    notes: '人物类关键词，内容确实围绕该人物的事件展开',
  },
  {
    keyword: '李一舟',
    content:
      '本文盘点了近年来争议较大的几位网络红人，文中提到"类似李一舟这样靠贩卖焦虑走红的案例并不少见"，但主要篇幅在分析另外两位完全不同领域的网红。',
    expected: false,
    notes: '人物只是作为案例对比被提及一次，并非本文主角',
  },

  // ── 产品更新类 ──
  {
    keyword: 'Cursor',
    content:
      'Cursor 编辑器今日推送 v2.0 更新，新增了多文件协同编辑、内置终端 AI 助手等功能，官方博客详细介绍了每项新特性的使用方法和适用场景。',
    expected: true,
    notes: '产品更新类，内容紧扣关键词产品本身',
  },
  {
    keyword: 'Cursor',
    content:
      '一篇关于"如何选择 AI 编程工具"的横向测评文章，作者试用了 Cursor、Windsurf、Trae 等多款产品，但全文 80% 篇幅在夸 Windsurf 的体验，对 Cursor 仅一笔带过称"用过，但不太习惯"。',
    expected: false,
    notes: '横向测评中关键词只占极小篇幅，核心内容是另一款产品',
  },
];

async function run() {
  console.log(`\n开始评估 verifyKeywordMatch — 共 ${TEST_CASES.length} 条测试用例\n`);

  let correct = 0;
  const mismatches: Array<TestCase & { actual: KeywordVerifyResult }> = [];

  for (const [i, tc] of TEST_CASES.entries()) {
    let actual: KeywordVerifyResult;
    try {
      actual = await verifyKeywordMatch(tc.content, tc.keyword);
    } catch (e) {
      actual = { matched: false, confidence: 0, reason: `[eval] AI 调用失败：${(e as Error).message}` };
    }
    const isCorrect = actual.matched === tc.expected;
    if (isCorrect) correct++;
    else mismatches.push({ ...tc, actual });

    const mark = isCorrect ? '✅' : '❌';
    console.log(
      `${mark} [${i + 1}/${TEST_CASES.length}] "${tc.keyword}" — 期望${tc.expected ? '匹配' : '不匹配'} / 实际${actual.matched ? '匹配' : '不匹配'}（置信度 ${actual.confidence.toFixed(2)}）`
    );
    console.log(`   AI 理由：${actual.reason}`);
    if (!isCorrect) console.log(`   📝 用例说明：${tc.notes}`);
    console.log('');
  }

  const accuracy = (correct / TEST_CASES.length) * 100;
  console.log('═'.repeat(60));
  console.log(`准确率：${correct}/${TEST_CASES.length} = ${accuracy.toFixed(1)}%`);

  if (mismatches.length > 0) {
    console.log(`\n误判样本详情（共 ${mismatches.length} 条，可据此调整 prompt 后重跑本脚本对比）：`);
    mismatches.forEach((m, i) => {
      console.log(`\n${i + 1}. 关键词："${m.keyword}"`);
      console.log(`   内容：${m.content.slice(0, 120)}${m.content.length > 120 ? '…' : ''}`);
      console.log(`   期望：${m.expected ? '匹配' : '不匹配'} | 实际：${m.actual.matched ? '匹配' : '不匹配'}（置信度 ${m.actual.confidence.toFixed(2)}）`);
      console.log(`   AI 理由：${m.actual.reason}`);
      console.log(`   用例说明：${m.notes}`);
    });
  } else {
    console.log('\n🎉 全部用例通过！');
  }

  process.exit(mismatches.length > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('评估脚本运行失败：', e);
  process.exit(1);
});
