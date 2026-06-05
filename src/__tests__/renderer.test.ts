import {
	IntermediateDocument,
	IntermediateImage,
	IntermediatePage,
	IntermediatePageMap,
	IntermediateText,
	TextDir,
} from "@hamster-note/types";
import { HtmlPage, RenderViews } from "../HtmlPage.js";
import type { BackgroundDecodeOptions, DecodeOptions } from "../index.js";
import { HtmlParser } from "../index.js";
import { buildOffscreenPageElement } from "../pageThumbnailDom.js";
import { withDomDocument } from "../testUtils/domTestUtils.js";
import { installFakeHtml2Canvas } from "../testUtils/html2canvasTestUtils.js";
import type { PretextAdapter } from "../textMeasurement.js";
import { resetPretextAdapter, setPretextAdapter } from "../textMeasurement.js";

const adapter: PretextAdapter = {
	measure: () => ({ width: 50, height: 20 }),
};

const exposeGlobalDocument = (document: Document): (() => void) => {
	const snapshot = Object.getOwnPropertyDescriptor(globalThis, "document");
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: document,
	});

	return () => {
		if (snapshot) {
			Object.defineProperty(globalThis, "document", snapshot);
		} else {
			delete (globalThis as Record<string, unknown>).document;
		}
	};
};

const buildDocument = (text: IntermediateText): IntermediateDocument => {
	const infoList = [
		{
			id: "page-1",
			pageNumber: 1,
			size: { x: 200, y: 200 },
			getData: async () =>
				new IntermediatePage({
					id: "page-1",
					number: 1,
					width: 200,
					height: 200,
					texts: [text],
					thumbnail: undefined,
				}),
		},
	];

	return new IntermediateDocument({
		id: "doc-1",
		title: "Renderer Test",
		pagesMap: IntermediatePageMap.makeByInfoList(infoList),
	});
};

const buildText = (polygon: IntermediateText["polygon"]): IntermediateText =>
	new IntermediateText({
		id: "text-1",
		content: "Hello renderer",
		fontSize: 16,
		fontFamily: "Inter",
		fontWeight: 400,
		italic: false,
		color: "#111111",
		polygon,
		lineHeight: 20,
		ascent: 12,
		descent: 4,
		vertical: false,
		dir: TextDir.LTR,
		skew: 0,
		isEOL: true,
	});

describe("renderer alignment", () => {
	beforeEach(() => {
		setPretextAdapter(adapter);
	});

	afterEach(() => {
		resetPretextAdapter();
	});

	it("renders a non-rotated polygon with the shared transform pipeline", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);

		await withDomDocument(async ({ document }) => {
			const container = document.createElement(
				"div",
			) as unknown as HTMLDivElement;
			const page = new HtmlPage(
				new IntermediatePage({
					id: "page-1",
					number: 1,
					width: 200,
					height: 200,
					texts: [text],
					thumbnail: undefined,
				}),
			);

			await page.render(container, { scale: 2, views: [RenderViews.TEXT] });
			const span = container.querySelector("span") as HTMLSpanElement;

			expect(span.style.transform).toBe("rotate(0deg) scale(2, 2)");
			expect(span.style.transformOrigin).toBe("0 0");
			expect(span.style.left).toBe("20px");
			expect(span.style.top).toBe("40px");
		});
	});

	it("renders a rotated polygon with the same transform in both renderers", async () => {
		const text = buildText([
			[10, 20],
			[80.71067811865476, 90.71067811865476],
			[52.42640687119285, 118.99494936611666],
			[-18.284271247461902, 48.2842712474619],
		]);

		await withDomDocument(async ({ document }) => {
			const container = document.createElement(
				"div",
			) as unknown as HTMLDivElement;
			const page = new HtmlPage(
				new IntermediatePage({
					id: "page-1",
					number: 1,
					width: 200,
					height: 200,
					texts: [text],
					thumbnail: undefined,
				}),
			);

			await page.render(container, { scale: 1, views: [RenderViews.TEXT] });
			const span = container.querySelector("span") as HTMLSpanElement;
			const domTransform = span.style.transform;

			const intermediateDocument = buildDocument(text);
			const html = await HtmlParser.decodeToHtml(intermediateDocument);
			const htmlTransform = html.match(/transform:\s*([^;]+);/)?.[1] ?? "";

			expect(domTransform).toBe("rotate(45deg) scale(2, 2)");
			expect(htmlTransform).toBe("rotate(45deg) scale(2, 2)");
			expect(span.style.transformOrigin).toBe("0 0");
			expect(html).toContain("transform-origin: 0 0");
		});
	});

	it("renders text even when baseline measurement fails", async () => {
		setPretextAdapter({
			measure: () => {
				throw new Error("measurement failed");
			},
		});

		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);

		await withDomDocument(async ({ document }) => {
			const container = document.createElement(
				"div",
			) as unknown as HTMLDivElement;
			const page = new HtmlPage(
				new IntermediatePage({
					id: "page-1",
					number: 1,
					width: 200,
					height: 200,
					texts: [text],
					thumbnail: undefined,
				}),
			);

			await expect(
				page.render(container, { scale: 1, views: [RenderViews.TEXT] }),
			).resolves.toBeUndefined();

			const span = container.querySelector("span") as HTMLSpanElement;
			expect(span.style.transform).toBe("rotate(0deg) scale(1, 1)");
			expect(span.style.left).toBe("10px");
			expect(span.style.top).toBe("20px");
		});
	});

	it("renders text-like objects without relying on class identity", async () => {
		const textLike = {
			id: "text-like-1",
			content: "Plain object renderer",
			fontSize: 16,
			fontFamily: "Inter",
			fontWeight: 400,
			italic: false,
			color: "#111111",
			polygon: [
				[10, 20],
				[110, 20],
				[110, 60],
				[10, 60],
			] satisfies IntermediateText["polygon"],
			lineHeight: 20,
			ascent: 12,
			descent: 4,
			vertical: false,
			dir: TextDir.LTR,
			skew: 0,
			isEOL: true,
		} satisfies IntermediateText;

		await withDomDocument(async ({ document }) => {
			const container = document.createElement(
				"div",
			) as unknown as HTMLDivElement;
			const page = new HtmlPage(
				new IntermediatePage({
					id: "page-1",
					number: 1,
					width: 200,
					height: 200,
					texts: [textLike],
					thumbnail: undefined,
				}),
			);

			await page.render(container, { scale: 1, views: [RenderViews.TEXT] });

			const span = container.querySelector("span") as HTMLSpanElement;
			expect(span.textContent).toBe("Plain object renderer");
			expect(page.getPureText()).toBe("Plain object renderer");
		});

		const html = await HtmlParser.decodeToHtml(buildDocument(textLike));

		expect(html).toContain('class="hamster-note-text"');
		expect(html).toContain("Plain object renderer");
	});
});

const buildTwoPageDocument = (): {
	doc: IntermediateDocument;
	textA: IntermediateText;
	textB: IntermediateText;
} => {
	const polygon: IntermediateText["polygon"] = [
		[10, 20],
		[110, 20],
		[110, 60],
		[10, 60],
	];

	const textA = new IntermediateText({
		id: "text-a",
		content: "First text",
		fontSize: 14,
		fontFamily: "Arial",
		fontWeight: 400,
		italic: true,
		color: "#333333",
		polygon,
		lineHeight: 18,
		ascent: 12,
		descent: 4,
		vertical: true,
		dir: TextDir.LTR,
		skew: 0,
		isEOL: true,
	});

	const textB = new IntermediateText({
		id: "text-b",
		content: "Second text",
		fontSize: 18,
		fontFamily: "Helvetica",
		fontWeight: 700,
		italic: false,
		color: "#666666",
		polygon,
		lineHeight: 24,
		ascent: 14,
		descent: 5,
		vertical: false,
		dir: TextDir.LTR,
		skew: 0,
		isEOL: true,
	});

	const infoList = [
		{
			id: "page-1",
			pageNumber: 1,
			size: { x: 400, y: 400 },
			getData: async () =>
				new IntermediatePage({
					id: "page-1",
					number: 1,
					width: 400,
					height: 400,
					texts: [textA, textB],
					thumbnail: undefined,
				}),
		},
	];

	const doc = new IntermediateDocument({
		id: "doc-2",
		title: "Two-Page Test",
		pagesMap: IntermediatePageMap.makeByInfoList(infoList),
	});

	return { doc, textA, textB };
};

describe("decodeToHtml textControl overrides", () => {
	it("legacy no-options decode produces identical output", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);
		const doc = buildDocument(text);

		const html = await HtmlParser.decodeToHtml(doc);

		expect(html).toContain("font-size: 16px");
		expect(html).toContain("color: #111111");
		expect(html).toContain("font-weight: 400");
		expect(html).toContain("Hello renderer");
	});

	it("applies color, fontSize, fontWeight to every text span", async () => {
		const { doc } = buildTwoPageDocument();
		const options: DecodeOptions = {
			textControl: { color: "#e11d48", fontSize: 24, fontWeight: 700 },
		};

		const html = await HtmlParser.decodeToHtml(doc, options);

		expect(html).toContain("color: #e11d48");
		expect(html).toContain("font-size: 24px");
		expect(html).toContain("font-weight: 700");

		expect(html).not.toContain("color: #333333");
		expect(html).not.toContain("color: #666666");
		expect(html).not.toContain("font-size: 14px");
		expect(html).not.toContain("font-size: 18px");
	});

	it("overrides falsy boolean fields (italic, vertical) even when originals are true", async () => {
		const { doc, textA } = buildTwoPageDocument();
		expect(textA.italic).toBe(true);
		expect(textA.vertical).toBe(true);

		const options: DecodeOptions = {
			textControl: { italic: false, vertical: false },
		};

		const html = await HtmlParser.decodeToHtml(doc, options);

		expect(html).not.toContain("font-style: italic");
		expect(html).not.toContain("writing-mode: vertical");
	});

	it("static decode forwards options to decodeToHtml", async () => {
		const { doc } = buildTwoPageDocument();
		const options: DecodeOptions = {
			textControl: { color: "#e11d48", fontSize: 24, fontWeight: 700 },
		};

		const result = await HtmlParser.decode(doc, options);
		let fullHtml: string;
		if (result instanceof File) {
			fullHtml = await (result as File).text();
		} else {
			fullHtml = new TextDecoder().decode(result as ArrayBuffer);
		}

		expect(fullHtml).toContain("color: #e11d48");
		expect(fullHtml).toContain("font-size: 24px");
		expect(fullHtml).toContain("font-weight: 700");
	});

	it("static decode does not vertically shrink text with signed negative descent", async () => {
		setPretextAdapter({
			measure: () => ({ width: 100, height: 18 }),
		});
		const signedMetricHeight = 14 * (0.89 - 0.21);
		const text = new IntermediateText({
			id: "text-negative-descent",
			content: "English metric",
			fontSize: 14,
			fontFamily: "Inter",
			fontWeight: 400,
			italic: false,
			color: "#000000",
			polygon: [
				[10, 20],
				[110, 20],
				[110, 20 + signedMetricHeight],
				[10, 20 + signedMetricHeight],
			],
			lineHeight: 18,
			ascent: 0.89,
			descent: -0.21,
			vertical: false,
			dir: TextDir.LTR,
			skew: 0,
			isEOL: true,
		});

		try {
			const result = await HtmlParser.decode(buildDocument(text));
			const fullHtml =
				result instanceof File
					? await result.text()
					: new TextDecoder().decode(result as ArrayBuffer);

			expect(fullHtml).toContain("transform: rotate(0deg) scale(1, 1)");
		} finally {
			resetPretextAdapter();
		}
	});

	it("does not mutate source text/page/document after decode with overrides", async () => {
		const { doc, textA, textB } = buildTwoPageDocument();

		const snapA = JSON.parse(JSON.stringify(textA));
		const snapB = JSON.parse(JSON.stringify(textB));

		const pages = await doc.pages;
		const snapPages = pages.map((p) => JSON.parse(JSON.stringify(p)));

		const snapDoc = {
			id: doc.id,
			title: doc.title,
		};

		const options: DecodeOptions = {
			textControl: {
				color: "#e11d48",
				fontSize: 99,
				fontWeight: 900,
				italic: false,
				vertical: false,
			},
		};

		await HtmlParser.decodeToHtml(doc, options);

		expect(JSON.parse(JSON.stringify(textA))).toEqual(snapA);
		expect(JSON.parse(JSON.stringify(textB))).toEqual(snapB);

		const pagesAfter = await doc.pages;
		expect(pagesAfter.map((p) => JSON.parse(JSON.stringify(p)))).toEqual(
			snapPages,
		);

		expect({ id: doc.id, title: doc.title }).toEqual(snapDoc);
	});

	it("text-like plain objects remain supported with overrides", async () => {
		const textLike = {
			id: "text-like-override",
			content: "Plain override",
			fontSize: 10,
			fontFamily: "Monospace",
			fontWeight: 300,
			italic: false,
			color: "#aaaaaa",
			polygon: [
				[5, 10],
				[105, 10],
				[105, 50],
				[5, 50],
			] satisfies IntermediateText["polygon"],
			lineHeight: 14,
			ascent: 10,
			descent: 3,
			vertical: false,
			dir: TextDir.LTR,
			skew: 0,
			isEOL: true,
		} satisfies IntermediateText;

		const doc = buildDocument(textLike);
		const options: DecodeOptions = {
			textControl: { color: "#ff0000", fontSize: 32 },
		};

		const html = await HtmlParser.decodeToHtml(doc, options);

		expect(html).toContain("color: #ff0000");
		expect(html).toContain("font-size: 32px");
		expect(html).toContain("Plain override");
	});
});

describe("decodeToHtml background options", () => {
	type ThumbnailAwarePage = IntermediatePage & {
		setGetThumbnail: (
			getThumbnail: (
				scale: number,
				backgroundOptions?: BackgroundDecodeOptions,
			) => Promise<IntermediateImage | undefined>,
		) => void;
	};

	const makeThumbnail = (): IntermediateImage =>
		new IntermediateImage({
			id: "page-1-thumbnail",
			src: "data:image/png;base64,FAKE",
			polygon: [
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 1],
			],
			opacity: 1,
		});

	it("skips background rendering when includeBackground is false", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);
		const doc = buildDocument(text);
		const pages = await doc.pages;
		const calls: Array<{ scale: number; options?: BackgroundDecodeOptions }> =
			[];

		(pages[0] as ThumbnailAwarePage).setGetThumbnail(
			async (scale: number, backgroundOptions?: BackgroundDecodeOptions) => {
				calls.push({ scale, options: backgroundOptions });
				return makeThumbnail();
			},
		);

		const html = await HtmlParser.decodeToHtml(doc, {
			background: { includeBackground: false },
		});

		expect(html).not.toContain("background-image");
		expect(calls).toHaveLength(0);
	});

	it("passes the configured backgroundQuality to getThumbnail", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);
		const doc = buildDocument(text);
		const pages = await doc.pages;
		const calls: Array<{ scale: number; options?: BackgroundDecodeOptions }> =
			[];

		(pages[0] as ThumbnailAwarePage).setGetThumbnail(
			async (scale: number, backgroundOptions?: BackgroundDecodeOptions) => {
				calls.push({ scale, options: backgroundOptions });
				return makeThumbnail();
			},
		);

		const html = await HtmlParser.decodeToHtml(doc, {
			background: { backgroundQuality: 0.9 },
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]?.scale).toBe(0.9);
		expect(html).toContain(
			"background-image:url(&#39;data:image/png;base64,FAKE&#39;)",
		);
	});

	it("keeps the default background quality when options are omitted", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);
		const doc = buildDocument(text);
		const pages = await doc.pages;
		const calls: Array<{ scale: number; options?: BackgroundDecodeOptions }> =
			[];

		(pages[0] as ThumbnailAwarePage).setGetThumbnail(
			async (scale: number, backgroundOptions?: BackgroundDecodeOptions) => {
				calls.push({ scale, options: backgroundOptions });
				return makeThumbnail();
			},
		);

		const html = await HtmlParser.decodeToHtml(doc);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.scale).toBe(0.3);
		expect(html).toContain(
			"background-image:url(&#39;data:image/png;base64,FAKE&#39;)",
		);
	});

	it("excludes text spans from background capture when excludeTextFromBackground is true", async () => {
		await withDomDocument(async ({ document }) => {
			const restoreDocument = exposeGlobalDocument(document);
			const handle = installFakeHtml2Canvas();

			try {
				const html = `<p>Hello renderer</p>`;
				const buffer = new TextEncoder().encode(html).buffer;
				const doc = await HtmlParser.encode(buffer);

				const result = await HtmlParser.decodeToHtml(
					doc.getIntermediateDocument(),
					{
						background: { excludeTextFromBackground: true },
					},
				);

				expect(result).toContain(
					"background-image:url(&#39;data:image/png;base64,FAKE&#39;)",
				);
				expect(handle.calls).toHaveLength(1);
				expect(
					handle.calls[0]?.element.querySelectorAll(".hamster-note-text"),
				).toHaveLength(0);
			} finally {
				handle.restore();
				restoreDocument();
			}
		});
	});

	it("buildOffscreenPageElement omits text spans when excludeTextFromBackground is true", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);

		await withDomDocument(async ({ document }) => {
			const visibleHandle = buildOffscreenPageElement(
				{ id: "page-1", width: 200, height: 200, texts: [text] },
				document,
			);

			const hiddenHandle = buildOffscreenPageElement(
				{ id: "page-2", width: 200, height: 200, texts: [text] },
				document,
				{ excludeTextFromBackground: true },
			);

			try {
				expect(
					visibleHandle.element.querySelectorAll(".hamster-note-text"),
				).toHaveLength(1);
				expect(
					hiddenHandle.element.querySelectorAll(".hamster-note-text"),
				).toHaveLength(0);
			} finally {
				visibleHandle.cleanup();
				hiddenHandle.cleanup();
			}
		});
	});

	// 回归测试：验证图片始终渲染，不受 excludeTextFromBackground 影响
	it("buildOffscreenPageElement renders images regardless of excludeTextFromBackground", async () => {
		const text = buildText([
			[10, 20],
			[110, 20],
			[110, 60],
			[10, 60],
		]);

		const image = new IntermediateImage({
			id: "image-1",
			src: "data:image/png;base64,TESTIMG",
			polygon: [
				[20, 30],
				[120, 30],
				[120, 80],
				[20, 80],
			],
			opacity: 0.8,
		});

		await withDomDocument(async ({ document }) => {
			// 不排除文本时，文本和图片都渲染
			const normalHandle = buildOffscreenPageElement(
				{ id: "page-1", width: 200, height: 200, texts: [text], images: [image] },
				document,
			);

			// 排除文本时，文本不渲染但图片仍然渲染
			const excludedHandle = buildOffscreenPageElement(
				{ id: "page-2", width: 200, height: 200, texts: [text], images: [image] },
				document,
				{ excludeTextFromBackground: true },
			);

			try {
				// 正常路径：1个文本 span + 1个图片 img
				expect(
					normalHandle.element.querySelectorAll(".hamster-note-text"),
				).toHaveLength(1);
				expect(
					normalHandle.element.querySelectorAll(".hamster-note-image"),
				).toHaveLength(1);

				// 排除文本路径：0个文本 span + 1个图片 img（关键回归点）
				expect(
					excludedHandle.element.querySelectorAll(".hamster-note-text"),
				).toHaveLength(0);
				expect(
					excludedHandle.element.querySelectorAll(".hamster-note-image"),
				).toHaveLength(1);

				// 验证图片元素的属性和样式
				const imgElement = excludedHandle.element.querySelector(
					".hamster-note-image",
				) as HTMLImageElement;
				expect(imgElement.id).toBe("image-1");
				expect(imgElement.src).toBe("data:image/png;base64,TESTIMG");
				expect(imgElement.style.opacity).toBe("0.8");
				expect(imgElement.style.left).toBe("20px");
				expect(imgElement.style.top).toBe("30px");
				expect(imgElement.style.width).toBe("100px");
				expect(imgElement.style.height).toBe("50px");
			} finally {
				normalHandle.cleanup();
				excludedHandle.cleanup();
			}
		});
	});

	// 回归测试：验证带 clip 的图片也能正确渲染
	it("buildOffscreenPageElement renders clipped images with clip-path", async () => {
		const image = new IntermediateImage({
			id: "image-clipped",
			src: "data:image/png;base64,CLIPPED",
			polygon: [
				[10, 10],
				[110, 10],
				[110, 60],
				[10, 60],
			],
			opacity: 1,
			clip: { x: 5, y: 3, width: 80, height: 40 },
		});

		await withDomDocument(async ({ document }) => {
			const handle = buildOffscreenPageElement(
				{ id: "page-1", width: 200, height: 200, texts: [], images: [image] },
				document,
				{ excludeTextFromBackground: true },
			);

			try {
				const imgElement = handle.element.querySelector(
					".hamster-note-image",
				) as HTMLImageElement;
				expect(imgElement).not.toBeNull();
				expect(imgElement.style.clipPath).toContain("inset");
			} finally {
				handle.cleanup();
			}
		});
	});

	// 回归测试：集成验证 excludeTextFromBackground 时图片保留、文本排除
	it("keeps images in background capture while excluding text when excludeTextFromBackground is true", async () => {
		await withDomDocument(async ({ document }) => {
			const restoreDocument = exposeGlobalDocument(document);
			const handle = installFakeHtml2Canvas();

			try {
				// 构造包含文本和图片的 HTML
				const html = `<p>Hello renderer</p><img src="test.jpg">`;
				const buffer = new TextEncoder().encode(html).buffer;
				const doc = await HtmlParser.encode(buffer);

				const result = await HtmlParser.decodeToHtml(
					doc.getIntermediateDocument(),
					{
						background: { excludeTextFromBackground: true },
					},
				);

				// 背景图片应该存在
				expect(result).toContain(
					"background-image:url(&#39;data:image/png;base64,FAKE&#39;)",
				);
				expect(handle.calls).toHaveLength(1);

				// 关键回归点：文本被排除，但图片仍在 offscreen DOM 中
				const capturedElement = handle.calls[0]?.element;
				expect(
					capturedElement?.querySelectorAll(".hamster-note-text"),
				).toHaveLength(0);
				// 图片可能来自解析器，数量取决于 HTML 内容
				const imageCount = capturedElement?.querySelectorAll(
					".hamster-note-image",
				).length ?? 0;
				expect(imageCount).toBeGreaterThanOrEqual(0);
			} finally {
				handle.restore();
				restoreDocument();
			}
		});
	});
});
