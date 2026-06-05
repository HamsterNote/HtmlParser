from __future__ import annotations

import json
from typing import Any

import pytest
from conftest import base_url, demo_page, page
from playwright.sync_api import Page, expect


STATUS_TIMEOUT_MS = 30_000


def _assert_valid_demo_document(parsed_output: dict[str, Any]) -> None:
    assert {"id", "title", "outline", "pages"}.issubset(parsed_output)

    pages = parsed_output["pages"]
    assert isinstance(pages, list)
    assert pages

    pages_text = json.dumps(pages, ensure_ascii=False)
    assert "First line" in pages_text or "Rotate me" in pages_text


def parse_and_wait(page: Page) -> dict[str, Any]:
    status = page.locator('[data-role="status"]')
    output = page.locator('[data-role="output"]')

    page.locator('[data-action="parse"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Done", timeout=STATUS_TIMEOUT_MS)

    output_text = output.text_content(timeout=STATUS_TIMEOUT_MS)
    assert output_text is not None
    assert "Click the button to inspect" not in output_text

    parsed_output = json.loads(output_text)
    _assert_valid_demo_document(parsed_output)
    return parsed_output


def get_preview_iframe_srcdoc(page: Page) -> str:
    preview = page.locator('[data-role="preview"]')
    iframe = preview.locator("iframe")

    iframe.wait_for(state="attached", timeout=STATUS_TIMEOUT_MS)
    iframe_class = iframe.get_attribute("class", timeout=STATUS_TIMEOUT_MS)
    assert iframe_class is not None
    assert "preview-frame" in iframe_class.split()

    srcdoc = iframe.get_attribute("srcdoc", timeout=STATUS_TIMEOUT_MS)
    assert srcdoc is not None
    return srcdoc


@pytest.mark.e2e
@pytest.mark.smoke
def test_parse_current_page_produces_intermediate_json(demo_page: Page) -> None:
    """验证解析当前演示页面后会生成包含页面内容的中间 JSON。"""
    parse_and_wait(demo_page)


@pytest.mark.e2e
@pytest.mark.smoke
def test_demo_page_contains_sample_image(demo_page: Page) -> None:
    """验证演示页面包含示例图片元素。"""
    image = demo_page.locator('.sample-image img')
    expect(image).to_have_count(1)
    expect(image).to_have_attribute('src', './assets/test.png')
    expect(image).to_have_attribute('alt', 'test image')


@pytest.mark.e2e
@pytest.mark.smoke
def test_parse_then_decode_renders_html_preview(demo_page: Page) -> None:
    """验证先解析再解码后会在预览区域渲染 HTML iframe。"""
    parse_and_wait(demo_page)

    status = demo_page.locator('[data-role="status"]')
    demo_page.locator('[data-action="decode"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Decode ready", timeout=STATUS_TIMEOUT_MS)

    srcdoc = get_preview_iframe_srcdoc(demo_page)
    assert "hamster-note-document" in srcdoc or "First line" in srcdoc or "Rotate me" in srcdoc

    demo_page.screenshot(path="/tmp/e2e-parse-decode-preview.png")


@pytest.mark.e2e
@pytest.mark.smoke
@pytest.mark.regression
def test_parse_still_works_after_decode_operations(demo_page: Page) -> None:
    """验证解码操作后再次解析仍能恢复为有效 JSON 输出。"""
    parse_and_wait(demo_page)

    status = demo_page.locator('[data-role="status"]')
    demo_page.locator('[data-action="decode"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Decode ready", timeout=STATUS_TIMEOUT_MS)

    second_parsed_output = parse_and_wait(demo_page)
    _assert_valid_demo_document(second_parsed_output)
    expect(status).to_have_text("Done", timeout=STATUS_TIMEOUT_MS)
