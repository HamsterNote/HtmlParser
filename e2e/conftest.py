"""HtmlParser E2E 测试的 Playwright 夹具配置。"""

from __future__ import annotations

import os
from glob import glob
from pathlib import Path
from typing import Generator

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright


def get_chrome_path() -> str | None:
    """查找可用的 Chromium/Chrome 可执行文件路径。"""
    env_path = os.environ.get("PLAYWRIGHT_CHROME_PATH")
    if env_path and Path(env_path).expanduser().is_file():
        return str(Path(env_path).expanduser())

    cache_patterns = [
        "~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome",
    ]
    for pattern in cache_patterns:
        matches = sorted(glob(str(Path(pattern).expanduser())), reverse=True)
        for match in matches:
            if Path(match).is_file():
                return match

    return None


@pytest.fixture(scope="session")
def playwright() -> Generator[Playwright, None, None]:
    """启动同步 Playwright，并在测试会话结束后关闭。"""
    manager = sync_playwright().start()
    try:
        yield manager
    finally:
        manager.stop()


@pytest.fixture(scope="session")
def browser(playwright: Playwright) -> Generator[Browser, None, None]:
    """启动 Chromium 浏览器，默认无头运行，支持本地调试切换。"""
    launch_options: dict[str, object] = {
        "headless": os.environ.get("E2E_HEADLESS") != "0",
    }
    chrome_path = get_chrome_path()
    if chrome_path is not None:
        launch_options["executable_path"] = chrome_path

    browser_instance = playwright.chromium.launch(**launch_options)
    try:
        yield browser_instance
    finally:
        browser_instance.close()


@pytest.fixture()
def context(browser: Browser) -> Generator[BrowserContext, None, None]:
    """为每个测试创建独立浏览器上下文，固定桌面视口大小。"""
    context_instance = browser.new_context(viewport={"width": 1280, "height": 900})
    try:
        yield context_instance
    finally:
        context_instance.close()


@pytest.fixture()
def page(context: BrowserContext, request: pytest.FixtureRequest) -> Generator[Page, None, None]:
    """创建页面并收集控制台消息与页面错误，便于失败时定位问题。"""
    console_messages: list[str] = []
    page_errors: list[str] = []
    page_instance = context.new_page()

    page_instance.on(
        "console",
        lambda message: console_messages.append(f"[{message.type}] {message.text}"),
    )
    page_instance.on("pageerror", lambda error: page_errors.append(str(error)))

    request.node._e2e_console_messages = console_messages
    request.node._e2e_page_errors = page_errors

    try:
        yield page_instance
    finally:
        page_instance.close()


@pytest.fixture(scope="session")
def base_url() -> str:
    """读取 E2E 服务地址，默认指向本地 HtmlParser demo 服务。"""
    return os.environ.get("E2E_BASE_URL", "http://127.0.0.1:8169")


@pytest.fixture()
def demo_page(page: Page, base_url: str) -> Page:
    """打开编码演示页面并等待网络空闲后返回页面对象。"""
    page.goto(f"{base_url}/demo/encode.html")
    page.wait_for_load_state("networkidle")
    return page


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[object]):
    """测试失败时把浏览器控制台日志与页面错误追加到 pytest 输出。"""
    outcome = yield
    report = outcome.get_result()
    if report.when != "call" or not report.failed:
        return

    console_messages = getattr(item, "_e2e_console_messages", [])
    if console_messages:
        report.sections.append(("Captured browser console", "\n".join(console_messages)))

    page_errors = getattr(item, "_e2e_page_errors", [])
    if page_errors:
        report.sections.append(("Captured page errors", "\n".join(page_errors)))
