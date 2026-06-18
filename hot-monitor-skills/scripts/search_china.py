#!/usr/bin/env python3
"""
中文平台搜索工具 — 为 Agent Skills 提供 Bilibili / 微博搜索能力。

用法:
  python search_china.py <keyword> [--source all|bilibili|weibo] [--limit 5]

输出:
  JSON 数组，每条包含: title, url, content, source, publishedAt, points

示例:
  python search_china.py "Claude Sonnet 5" --limit 5
  python search_china.py "GPT-5" --source bilibili --limit 3
"""

import sys
import re
import json
import argparse
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print(json.dumps({"error": "缺少依赖，请先执行: pip install -r requirements.txt"}))
    sys.exit(1)

BILI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com',
}

WEIBO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://weibo.com',
    'MWeibo-Pwa': '1',
}


def clean_html(text: str) -> str:
    """移除 HTML 标签和 Bilibili 高亮标记"""
    text = re.sub(r'<em[^>]*>', '', text)
    text = re.sub(r'</em>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def ts_to_iso(ts: int) -> str:
    """Unix 时间戳转 ISO 8601 字符串"""
    if not ts:
        return ''
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def search_bilibili(keyword: str, limit: int = 5) -> list:
    """
    搜索 Bilibili 视频，返回结构化结果列表。
    使用公开搜索 API，无需登录，无需 Cookie。
    """
    results = []
    try:
        resp = requests.get(
            'https://api.bilibili.com/x/web-interface/search/type',
            params={
                'search_type': 'video',
                'keyword': keyword,
                'page': 1,
                'pagesize': min(limit, 20),
                'order': 'pubdate',  # 按最新排序
            },
            headers=BILI_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        if 'text/html' in resp.headers.get('Content-Type', ''):
            log('[Bilibili] 触发风控拦截（返回 HTML），跳过 B 站搜索')
            return []
        data = resp.json()
        items = (data.get('data') or {}).get('result') or []
        for item in items[:limit]:
            bvid = item.get('bvid', '')
            play = item.get('play', 0)
            # 播放量有时是字符串（如 "1.3万"）
            if isinstance(play, str):
                play = 0
            results.append({
                'title': clean_html(item.get('title', '')),
                'url': f'https://www.bilibili.com/video/{bvid}' if bvid else '',
                'content': clean_html(item.get('description', '')),
                'source': f"Bilibili · {item.get('author', '')}",
                'publishedAt': ts_to_iso(item.get('pubdate', 0)),
                'points': play,
            })
    except requests.exceptions.RequestException as e:
        log(f'[Bilibili] 网络请求失败: {e}')
    except Exception as e:
        log(f'[Bilibili] 解析失败: {e}')
    return results


def search_weibo(keyword: str, limit: int = 5) -> list:
    """
    搜索微博内容，返回结构化结果列表。
    使用移动端 API，无登录态时仍可获取部分公开内容。
    若触发鉴权（ok=-100）则返回空列表，不影响整体流程。
    """
    results = []
    try:
        resp = requests.get(
            'https://m.weibo.cn/api/container/getIndex',
            params={
                'containerid': f'100103type=1&q={keyword}&t=0',
                'page_type': 'searchall',
                'page': 1,
            },
            headers=WEIBO_HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        if 'text/html' in resp.headers.get('Content-Type', ''):
            log('[Weibo] 触发访客验证（返回 HTML），跳过微博搜索')
            return []
        data = resp.json()

        # ok=-100 表示需要登录
        if data.get('ok') == -100:
            log('[Weibo] 需要登录态，跳过微博搜索（不影响其他来源）')
            return []

        cards = (data.get('data') or {}).get('cards') or []
        for card in cards:
            # 直接包含 mblog 的卡片
            mblog = card.get('mblog')
            # card_group 类型（话题聚合）
            if not mblog and card.get('card_group'):
                for sub in card['card_group']:
                    if sub.get('mblog'):
                        mblog = sub['mblog']
                        break
            if not mblog:
                continue

            user = mblog.get('user') or {}
            uid = user.get('id', '')
            bid = mblog.get('bid', mblog.get('mid', ''))
            raw_text = mblog.get('text', '')
            text = clean_html(raw_text.replace('<br />', ' ').replace('<br/>', ' '))
            screen_name = user.get('screen_name', '')

            results.append({
                'title': f'@{screen_name}: {text[:120]}',
                'url': f'https://weibo.com/{uid}/{bid}' if uid and bid else '',
                'content': text,
                'source': f'微博 · @{screen_name}',
                'publishedAt': mblog.get('created_at', ''),
                'points': mblog.get('attitudes_count', 0),
            })
            if len(results) >= limit:
                break
    except requests.exceptions.RequestException as e:
        log(f'[Weibo] 网络请求失败: {e}')
    except Exception as e:
        log(f'[Weibo] 解析失败: {e}')
    return results


def log(msg: str):
    """输出日志到 stderr，不污染 stdout 的 JSON 输出"""
    print(msg, file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(
        description='中文平台热点搜索（Bilibili + 微博）',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument('keyword', help='搜索关键词')
    parser.add_argument(
        '--source',
        choices=['all', 'bilibili', 'weibo'],
        default='all',
        help='搜索来源（默认 all）',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=5,
        help='每个平台返回条数（默认 5）',
    )
    args = parser.parse_args()

    results = []

    if args.source in ('all', 'bilibili'):
        bili = search_bilibili(args.keyword, args.limit)
        log(f'[Bilibili] 找到 {len(bili)} 条结果')
        results.extend(bili)

    if args.source in ('all', 'weibo'):
        weibo = search_weibo(args.keyword, args.limit)
        log(f'[Weibo] 找到 {len(weibo)} 条结果')
        results.extend(weibo)

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
