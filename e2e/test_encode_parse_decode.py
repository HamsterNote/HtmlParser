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


def inject_tall_sample_content(page: Page) -> None:
    page.locator('#sample-content').evaluate(
        """
        element => {
            const tall = document.createElement('div')
            tall.setAttribute('data-e2e', 'tall-scroll-fixture')
            tall.style.cssText = 'height: 2400px; padding-top: 16px; background: linear-gradient(#fff, #eef2ff);'
            tall.textContent = 'Deterministic tall content for decoded preview scroll regression.'
            element.append(tall)
        }
        """
    )


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
    expect(image).to_have_attribute('alt', 'test sample')


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
@pytest.mark.regression
def test_decoded_preview_iframe_document_body_scrolls(demo_page: Page) -> None:
    demo_page.locator('[data-role="snapshot-width"]').fill("1200")
    inject_tall_sample_content(demo_page)
    parse_and_wait(demo_page)

    status = demo_page.locator('[data-role="status"]')
    demo_page.locator('[data-action="decode"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Decode ready", timeout=STATUS_TIMEOUT_MS)

    iframe = demo_page.locator('[data-role="preview"] iframe')
    iframe.wait_for(state="attached", timeout=STATUS_TIMEOUT_MS)
    iframe.evaluate("element => { element.style.height = '360px'; element.style.minHeight = '0' }")
    iframe_handle = iframe.element_handle(timeout=STATUS_TIMEOUT_MS)
    assert iframe_handle is not None
    preview_frame = iframe_handle.content_frame()
    assert preview_frame is not None

    preview_frame.wait_for_load_state("domcontentloaded", timeout=STATUS_TIMEOUT_MS)
    preview_frame.locator('.hamster-note-page').wait_for(
        state="attached",
        timeout=STATUS_TIMEOUT_MS,
    )

    metrics = preview_frame.evaluate(
        """
        () => {
            const scrollingElement = document.scrollingElement || document.documentElement || document.body
            const page = document.querySelector('.hamster-note-page')
            const clientHeight = scrollingElement.clientHeight || document.documentElement.clientHeight || window.innerHeight
            const scrollHeight = Math.max(
                scrollingElement.scrollHeight,
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            )
            const target = Math.max(1, scrollHeight - clientHeight)

            window.scrollTo(0, 0)
            scrollingElement.scrollTop = 0
            const before = scrollingElement.scrollTop
            window.scrollTo(0, target)
            const after = scrollingElement.scrollTop

            return {
                after,
                before,
                clientHeight,
                pageScrollTop: page ? page.scrollTop : null,
                scrollHeight,
                target,
            }
        }
        """
    )

    assert metrics["scrollHeight"] > metrics["clientHeight"]
    assert metrics["after"] > metrics["before"]
    assert metrics["pageScrollTop"] in (0, None)


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
