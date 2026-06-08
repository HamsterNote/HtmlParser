"""Snapshot-width optional input E2E tests.

这些测试验证 demo/encode.html 中 snapshot-width 输入控件的存在与行为。
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from conftest import base_url as base_url, demo_page as demo_page, page as page  # noqa: F401
from playwright.sync_api import Page, expect


STATUS_TIMEOUT_MS = 30_000


# ---------------------------------------------------------------------------
# 1. DOM 结构测试：snapshot-width 输入控件存在性
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_encode_page_has_snapshot_width_input(demo_page: Page) -> None:
    """验证编码演示页包含 data-role="snapshot-width" 的 number 输入框。"""
    locator = demo_page.locator('[data-role="snapshot-width"]')
    expect(locator).to_have_count(1)


@pytest.mark.e2e
def test_snapshot_width_input_is_number_type(demo_page: Page) -> None:
    """验证 snapshot-width 输入框的 type 为 number。"""
    locator = demo_page.locator('[data-role="snapshot-width"]')
    expect(locator).to_have_count(1)
    expect(locator).to_have_attribute("type", "number")


@pytest.mark.e2e
def test_snapshot_width_input_inside_exclude_selector_section(demo_page: Page) -> None:
    """验证 snapshot-width 输入框位于 exclude-selector-section 内部。"""
    section = demo_page.locator('.exclude-selector-section')
    expect(section).to_have_count(1)
    locator = section.locator('[data-role="snapshot-width"]')
    expect(locator).to_have_count(1)


@pytest.mark.e2e
def test_snapshot_width_input_appears_after_exclude_selectors(demo_page: Page) -> None:
    """验证 snapshot-width 输入框在 DOM 顺序上位于 exclude-selectors 输入框之后。"""
    exclude_box = demo_page.locator('[data-role="exclude-selectors"]').bounding_box()
    snapshot_box = demo_page.locator('[data-role="snapshot-width"]').bounding_box()
    assert exclude_box is not None, "exclude-selectors input not found"
    assert snapshot_box is not None, "snapshot-width input not found"
    # snapshot-width should be below exclude-selectors in vertical position
    assert snapshot_box["y"] > exclude_box["y"], (
        f"snapshot-width (y={snapshot_box['y']}) should be below "
        f"exclude-selectors (y={exclude_box['y']})"
    )


# ---------------------------------------------------------------------------
# 2. Parse 流程集成测试：snapshotWidth 传递到 encode 结果
# ---------------------------------------------------------------------------

@pytest.mark.e2e
def test_parse_with_snapshot_width_input_populated(demo_page: Page) -> None:
    """验证填入 snapshot-width 数值后点击 Parse，JSON 输出成功。"""
    snapshot_input = demo_page.locator('[data-role="snapshot-width"]')
    expect(snapshot_input).to_have_count(1)
    snapshot_input.fill("640")

    status = demo_page.locator('[data-role="status"]')
    output = demo_page.locator('[data-role="output"]')

    demo_page.locator('[data-action="parse"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Done", timeout=STATUS_TIMEOUT_MS)

    output_text = output.text_content(timeout=STATUS_TIMEOUT_MS)
    assert output_text is not None
    assert "Click the button to inspect" not in output_text

    parsed = json.loads(output_text)
    assert {"id", "title", "outline", "pages"}.issubset(parsed)
    assert isinstance(parsed["pages"], list)
    assert len(parsed["pages"]) > 0


@pytest.mark.e2e
def test_parse_with_empty_snapshot_width_succeeds(demo_page: Page) -> None:
    """验证 snapshot-width 为空时 Parse 正常工作（向后兼容）。"""
    snapshot_input = demo_page.locator('[data-role="snapshot-width"]')
    expect(snapshot_input).to_have_count(1)
    snapshot_input.fill("")

    status = demo_page.locator('[data-role="status"]')
    output = demo_page.locator('[data-role="output"]')

    demo_page.locator('[data-action="parse"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Done", timeout=STATUS_TIMEOUT_MS)

    output_text = output.text_content(timeout=STATUS_TIMEOUT_MS)
    assert output_text is not None
    parsed = json.loads(output_text)
    assert {"id", "title", "outline", "pages"}.issubset(parsed)


@pytest.mark.e2e
def test_parse_with_invalid_snapshot_width_shows_error(demo_page: Page) -> None:
    """验证填入非法 snapshot-width 值后 Parse 显示失败状态。"""
    snapshot_input = demo_page.locator('[data-role="snapshot-width"]')
    expect(snapshot_input).to_have_count(1)
    # Chromium blocks typing non-numeric text into input[type=number]. Override
    # the value getter so the demo's validation branch still receives the
    # invalid string and can surface the deterministic error state.
    snapshot_input.evaluate(
        """
        element => Object.defineProperty(element, 'value', {
            configurable: true,
            get: () => 'not-a-number'
        })
        """
    )

    status = demo_page.locator('[data-role="status"]')

    demo_page.locator('[data-action="parse"]').click(timeout=STATUS_TIMEOUT_MS)
    expect(status).to_have_text("Failed", timeout=10_000)
