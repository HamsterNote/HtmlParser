"""编码演示页 JSON Input 到 Decode 流程的 E2E 测试。"""

from __future__ import annotations

import json
from typing import Any

import pytest
from conftest import base_url as base_url, demo_page as demo_page, page as page  # noqa: F401
from playwright.sync_api import Page, expect


SIMPLE_DOCUMENT: dict[str, Any] = {
    "id": "e2e-json-doc",
    "title": "E2E JSON Input Document",
    "outline": [],
    "pages": [
        {
            "id": "page-1",
            "number": 1,
            "width": 800,
            "height": 600,
            "texts": [
                {
                    "id": "text-1",
                    "content": "E2E JSON Flow",
                    "fontSize": 16,
                    "fontFamily": "sans-serif",
                    "fontWeight": 700,
                    "italic": False,
                    "color": "rgb(51, 51, 51)",
                    "polygon": [[20, 32], [140, 32], [140, 56], [20, 56]],
                    "lineHeight": 24,
                    "ascent": 16,
                    "descent": 8,
                    "vertical": False,
                    "dir": "ltr",
                    "skew": 0,
                    "isEOL": True,
                }
            ],
            "thumbnail": None,
        }
    ],
}


def fill_json_input(page: Page, data: dict[str, Any] | str) -> None:
    """填充 JSON 输入框，并显式触发 input 事件模拟真实编辑。"""
    value = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    page.fill('[data-role="json-input"]', value)
    page.dispatch_event('[data-role="json-input"]', "input")


def decode_input_and_wait(page: Page, expected_status: str = "Decode ready", timeout: int = 30000) -> None:
    """点击 Decode JSON Input 按钮，并等待状态进入指定结果。"""
    page.click('[data-action="decode-input"]')
    page.wait_for_selector(f'[data-role="status"]:has-text("{expected_status}")', timeout=timeout)


def get_preview_iframe_srcdoc(page: Page) -> str:
    """读取预览区域 iframe 的 srcdoc 内容，若为空则返回空字符串。"""
    iframe = page.locator('[data-role="preview"] iframe.preview-frame')
    expect(iframe).to_have_count(1)
    return iframe.get_attribute("srcdoc") or ""


@pytest.mark.e2e
@pytest.mark.smoke
def test_json_input_decode_renders_preview(demo_page: Page) -> None:
    """验证最小合法 IntermediateDocument JSON 能解码并渲染预览。"""
    fill_json_input(demo_page, SIMPLE_DOCUMENT)

    decode_input_and_wait(demo_page)

    demo_page.wait_for_selector('[data-role="preview"] iframe.preview-frame')
    srcdoc = get_preview_iframe_srcdoc(demo_page)
    assert "E2E JSON Flow" in srcdoc


@pytest.mark.e2e
def test_json_input_with_text_control_override(demo_page: Page) -> None:
    """验证 Text Control 覆盖样式会注入到解码后的预览 HTML。"""
    fill_json_input(demo_page, SIMPLE_DOCUMENT)
    demo_page.fill(
        '[data-role="text-control-input"]',
        '{"fontSize":24,"color":"#e11d48","fontWeight":"bold"}',
    )

    decode_input_and_wait(demo_page)

    srcdoc = get_preview_iframe_srcdoc(demo_page)
    assert "font-size: 24px" in srcdoc
    assert "color: #e11d48" in srcdoc


@pytest.mark.e2e
def test_json_input_with_background_options(demo_page: Page) -> None:
    """验证背景选项关闭时解码流程不崩溃并仍生成 iframe。"""
    fill_json_input(demo_page, SIMPLE_DOCUMENT)
    bg_include = demo_page.locator('[data-role="bg-include"]')
    if bg_include.is_checked():
        bg_include.uncheck()

    decode_input_and_wait(demo_page)

    expect(demo_page.locator('[data-role="preview"] iframe.preview-frame')).to_have_count(1)


@pytest.mark.e2e
def test_empty_json_input_shows_error(demo_page: Page) -> None:
    """验证空 JSON 输入会显示 Decode failed 与可读错误信息。"""
    fill_json_input(demo_page, "")

    decode_input_and_wait(demo_page, expected_status="Decode failed", timeout=10000)

    expect(demo_page.locator('[data-role="status"]')).to_contain_text("Decode failed")
    expect(demo_page.locator('[data-role="preview"]')).to_contain_text("Please enter valid JSON")


@pytest.mark.e2e
def test_invalid_json_input_shows_error(demo_page: Page) -> None:
    """验证非法 JSON 输入会进入失败状态并标记预览错误样式。"""
    fill_json_input(demo_page, "not json at all")

    decode_input_and_wait(demo_page, expected_status="Decode failed", timeout=10000)

    expect(demo_page.locator('[data-role="status"]')).to_contain_text("Decode failed")
    assert demo_page.locator('[data-role="preview"]').evaluate(
        "element => element.classList.contains('preview-error')"
    )
