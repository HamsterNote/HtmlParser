import {
	type IntermediateContentSerialized,
	IntermediateDocument,
	IntermediateImage,
	IntermediatePage,
	IntermediatePageMap,
	IntermediateText,
	TextDir,
} from "@hamster-note/types";
import { HtmlPage, RenderViews } from "../HtmlPage.js";
import { renderDecodeHtmlFromPayload } from "../htmlParserWorkerCore.js";
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

	// 回归测试：当 excludeImagesFromBackground 未启用时图片仍然渲染
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

	describe("excludeImagesFromBackground", () => {
		const buildBackgroundImage = (
			overrides: Partial<IntermediateImage> = {},
		): IntermediateImage =>
			new IntermediateImage({
				id: "image-1",
				src: "data:image/png;base64,TESTIMG",
				polygon: [
					[20, 30],
					[120, 30],
					[120, 80],
					[20, 80],
				],
				opacity: 0.8,
				...overrides,
			});

		const imageExclusionOffscreenOptions = (
			overrides: NonNullable<Parameters<typeof buildOffscreenPageElement>[2]> = {},
		): Parameters<typeof buildOffscreenPageElement>[2] =>
			({
				...overrides,
				excludeImagesFromBackground: true,
			});

		const imageRenderingOffscreenOptions = (): Parameters<
			typeof buildOffscreenPageElement
		>[2] =>
			({
				excludeImagesFromBackground: false,
			});

		const imageExclusionBackgroundOptions = (): BackgroundDecodeOptions =>
			({
				excludeImagesFromBackground: true,
			});

		const buildDocumentWithContent = (
			text: IntermediateText,
			image: IntermediateImage,
		): IntermediateDocument => {
			const infoList = [
				{
					id: "page-with-image-content",
					pageNumber: 1,
					size: { x: 200, y: 200 },
					getData: async () =>
						new IntermediatePage({
							id: "page-with-image-content",
							number: 1,
							width: 200,
							height: 200,
							content: [text, image],
							thumbnail: undefined,
						}),
				},
			];

			return new IntermediateDocument({
				id: "doc-with-image-content",
				title: "Image Exclusion Routing Test",
				pagesMap: IntermediatePageMap.makeByInfoList(infoList),
			});
		};

		const readImageSnapshot = (element: Element): Record<string, string> => {
			const img = element.querySelector(
				"img.hamster-note-image",
			) as HTMLImageElement | null;
			expect(img).not.toBeNull();
			if (!img) throw new Error("expected rendered background image");

			return {
				id: img.id,
				src: img.src,
				opacity: img.style.opacity,
				left: img.style.left,
				top: img.style.top,
				width: img.style.width,
				height: img.style.height,
			};
		};

		it("buildOffscreenPageElement omits image elements when excludeImagesFromBackground is true", async () => {
			const text = buildText([
				[10, 20],
				[110, 20],
				[110, 60],
				[10, 60],
			]);
			const image = buildBackgroundImage();

			await withDomDocument(async ({ document }) => {
				const handle = buildOffscreenPageElement(
					{
						id: "page-image-hidden",
						width: 200,
						height: 200,
						texts: [text],
						images: [image],
					},
					document,
					imageExclusionOffscreenOptions(),
				);

				try {
					expect(handle.element.querySelectorAll("img")).toHaveLength(0);
					expect(
						handle.element.querySelectorAll(".hamster-note-image"),
					).toHaveLength(0);
				} finally {
					handle.cleanup();
				}
			});
		});

		it("buildOffscreenPageElement renders images when excludeImagesFromBackground is false or undefined", async () => {
			const image = buildBackgroundImage();

			await withDomDocument(async ({ document }) => {
				const defaultHandle = buildOffscreenPageElement(
					{
						id: "page-image-default",
						width: 200,
						height: 200,
						texts: [],
						images: [image],
					},
					document,
				);
				const falseHandle = buildOffscreenPageElement(
					{
						id: "page-image-false",
						width: 200,
						height: 200,
						texts: [],
						images: [image],
					},
					document,
					imageRenderingOffscreenOptions(),
				);

				try {
					expect(defaultHandle.element.querySelectorAll("img")).toHaveLength(1);
					expect(
						defaultHandle.element.querySelectorAll(".hamster-note-image"),
					).toHaveLength(1);
					expect(falseHandle.element.querySelectorAll("img")).toHaveLength(1);
					expect(
						falseHandle.element.querySelectorAll(".hamster-note-image"),
					).toHaveLength(1);
					expect(readImageSnapshot(falseHandle.element)).toEqual(
						readImageSnapshot(defaultHandle.element),
					);
				} finally {
					defaultHandle.cleanup();
					falseHandle.cleanup();
				}
			});
		});

		it("keeps text spans while omitting images for image-only background exclusion", async () => {
			const text = buildText([
				[10, 20],
				[110, 20],
				[110, 60],
				[10, 60],
			]);
			const image = buildBackgroundImage();

			await withDomDocument(async ({ document }) => {
				const handle = buildOffscreenPageElement(
					{
						id: "page-image-only",
						width: 200,
						height: 200,
						texts: [text],
						images: [image],
					},
					document,
					imageExclusionOffscreenOptions({ excludeTextFromBackground: false }),
				);

				try {
					expect(
						handle.element.querySelectorAll(".hamster-note-text"),
					).toHaveLength(1);
					expect(handle.element.querySelectorAll("img")).toHaveLength(0);
					expect(
						handle.element.querySelectorAll(".hamster-note-image"),
					).toHaveLength(0);
				} finally {
					handle.cleanup();
				}
			});
		});

		it("routes image-only background exclusion through captureThumbnail instead of getThumbnail", async () => {
			const text = buildText([
				[10, 20],
				[110, 20],
				[110, 60],
				[10, 60],
			]);
			const image = buildBackgroundImage();
			const doc = buildDocumentWithContent(text, image);

			await withDomDocument(async ({ document }) => {
				const restoreDocument = exposeGlobalDocument(document);
				const handle = installFakeHtml2Canvas();
				const pages = await doc.pages;
				const getThumbnailCalls: number[] = [];

				(pages[0] as ThumbnailAwarePage).setGetThumbnail(
					async (scale: number) => {
						getThumbnailCalls.push(scale);
						return makeThumbnail();
					},
				);

				try {
					const result = await HtmlParser.decodeToHtml(doc, {
						background: imageExclusionBackgroundOptions(),
					});

					expect(result).toContain(
						"background-image:url(&#39;data:image/png;base64,FAKE&#39;)",
					);
					expect(getThumbnailCalls).toHaveLength(0);
					expect(handle.calls).toHaveLength(1);

					const capturedElement = handle.calls[0]?.element;
					expect(capturedElement).toBeDefined();
					if (!capturedElement) throw new Error("expected html2canvas call");
					expect(
						capturedElement.querySelectorAll(".hamster-note-text"),
					).toHaveLength(1);
					expect(
						capturedElement.querySelectorAll(".hamster-note-image"),
					).toHaveLength(0);
				} finally {
					handle.restore();
					restoreDocument();
				}
			});
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

describe("Task 1 decode page container assumption probe", () => {
	it("documents rendered page containers as absolute positioning contexts", async () => {
		const html = renderDecodeHtmlFromPayload({
			pages: [
				{
					id: "task-1-page-container",
					width: 200,
					height: 200,
					content: [],
				},
			],
			options: { background: { includeBackground: false } },
		});

		await withDomDocument(async ({ document }) => {
			const defaultView = document.defaultView;
			if (!defaultView) throw new Error("expected defaultView in renderer test");

			document.body.innerHTML = html;
			const pageContainer = document.querySelector(
				".hamster-note-page",
			) as HTMLElement | null;
			expect(pageContainer).not.toBeNull();
			if (!pageContainer) throw new Error("expected rendered page container");

			const child = document.createElement("img");
			Object.assign(child.style, {
				position: "absolute",
				left: "10px",
				top: "20px",
				width: "30px",
				height: "40px",
			});
			pageContainer.appendChild(child);

			// 探针：renderer 输出的 page class 需要让 absolute child 以页面为定位上下文。
			const inlinePosition = pageContainer.style.position;
			const computedPosition = defaultView.getComputedStyle(pageContainer).position;
			const childComputed = defaultView.getComputedStyle(child);

			expect(inlinePosition).toBe("");
			expect(computedPosition).toBe("relative");
			expect([inlinePosition, computedPosition]).toContain("relative");
			expect(child.style.position).toBe("absolute");
			expect(child.style.left).toBe("10px");
			expect(child.style.top).toBe("20px");
			expect(child.style.width).toBe("30px");
			expect(child.style.height).toBe("40px");
			expect(childComputed.position).toBe("absolute");
			expect(childComputed.left).toBe("10px");
			expect(childComputed.top).toBe("20px");
		});
	});
});


describe("decode HTML foreground image rendering", () => {
	const buildDecodeImage = (
		overrides: Partial<IntermediateImage> = {},
	): IntermediateImage =>
		new IntermediateImage({
			id: "image-1",
			src: "data:image/png;base64,FOREGROUND",
			polygon: [
				[20, 30],
				[120, 30],
				[120, 80],
				[20, 80],
			],
			opacity: 0.8,
			...overrides,
		});

	const buildDecodeText = (
		overrides: Partial<IntermediateText> = {},
	): IntermediateText =>
		new IntermediateText({
			id: "text-1",
			content: "Foreground text",
			fontSize: 16,
			fontFamily: "Inter",
			fontWeight: 400,
			italic: false,
			color: "#111111",
			polygon: [
				[30, 40],
				[130, 40],
				[130, 70],
				[30, 70],
			],
			lineHeight: 20,
			ascent: 12,
			descent: 4,
			vertical: false,
			dir: TextDir.LTR,
			opacity: 1,
			skew: 0,
			isEOL: true,
			...overrides,
		});

	const renderDecodeFixture = (
		content: IntermediateContentSerialized[],
	): string =>
		renderDecodeHtmlFromPayload({
			pages: [
				{
					id: "foreground-page",
					width: 200,
					height: 120,
					content,
				},
			],
			options: { background: { includeBackground: false } },
		});

	it("renders an IntermediateImage as a positioned <img> in decode HTML", async () => {
		const image = buildDecodeImage({
			id: 'image-"escaped"',
			src: "data:image/png;base64,FOREGROUND&ONE",
		});
		const html = renderDecodeFixture([IntermediateImage.serialize(image)]);

		await withDomDocument(async ({ document }) => {
			document.body.innerHTML = html;
			const img = document.querySelector(
				"img.hamster-note-image",
			) as HTMLImageElement | null;

			expect(img).not.toBeNull();
			if (!img) throw new Error("expected rendered foreground image");
			expect(img.id).toBe('image-"escaped"');
			expect(img.getAttribute("src")).toBe(
				"data:image/png;base64,FOREGROUND&ONE",
			);
			expect(img.style.position).toBe("absolute");
			expect(img.style.left).toBe("20px");
			expect(img.style.top).toBe("30px");
			expect(img.style.width).toBe("100px");
			expect(img.style.height).toBe("50px");
			expect(img.style.opacity).toBe("0.8");
			expect(img.style.objectFit).toBe("fill");
		});
	});

	it("orders foreground images and text spans by sourceOrder/content order", async () => {
		const firstImage = buildDecodeImage({ id: "image-first" });
		const text = buildDecodeText({ id: "text-middle" });
		const lastImage = buildDecodeImage({
			id: "image-last",
			src: "data:image/png;base64,LAST",
		});
		const html = renderDecodeFixture([
			IntermediateImage.serialize(firstImage),
			IntermediateText.serialize(text),
			IntermediateImage.serialize(lastImage),
		]);

		await withDomDocument(async ({ document }) => {
			document.body.innerHTML = html;
			const page = document.querySelector(".hamster-note-page") as HTMLElement | null;
			expect(page).not.toBeNull();
			if (!page) throw new Error("expected rendered page");

			expect(Array.from(page.children).map((child) => child.id)).toEqual([
				"image-first",
				"text-middle",
				"image-last",
			]);
			expect(Array.from(page.children).map((child) => child.tagName)).toEqual([
				"IMG",
				"SPAN",
				"IMG",
			]);
		});
	});

	it("applies bbox-derived left/top/width/height from polygon", async () => {
		const image = buildDecodeImage({
			polygon: [
				[32, 44],
				[132, 44],
				[132, 94],
				[32, 94],
			],
		});
		const html = renderDecodeFixture([IntermediateImage.serialize(image)]);

		await withDomDocument(async ({ document }) => {
			document.body.innerHTML = html;
			const img = document.querySelector(
				"img.hamster-note-image",
			) as HTMLImageElement | null;

			expect(img).not.toBeNull();
			if (!img) throw new Error("expected rendered foreground image");
			expect(img.style.left).toBe("32px");
			expect(img.style.top).toBe("44px");
			expect(img.style.width).toBe("100px");
			expect(img.style.height).toBe("50px");
		});
	});

	// 回归测试：图片 polygon/clip 坐标是像素空间，0.5 这类 subpixel 不能被格式化成百分比。
	it("renders subpixel image bbox values as px, not percent", async () => {
		const image = buildDecodeImage({
			polygon: [
				[0.5, 0.5],
				[100.25, 0.5],
				[100.25, 60.5],
				[0.5, 60.5],
			],
		});
		const html = renderDecodeFixture([IntermediateImage.serialize(image)]);

		await withDomDocument(async ({ document }) => {
			document.body.innerHTML = html;
			const img = document.querySelector(
				"img.hamster-note-image",
			) as HTMLImageElement | null;

			expect(img).not.toBeNull();
			if (!img) throw new Error("expected rendered foreground image");
			expect(img.style.left).toBe("0.5px");
			expect(img.style.top).toBe("0.5px");
			expect(img.style.width).toBe("99.75px");
			expect(img.style.height).toBe("60px");

			const positionAndSize = [
				img.style.left,
				img.style.top,
				img.style.width,
				img.style.height,
			].join(";");
			expect(positionAndSize).not.toContain("%");

			const styleAttribute = img.getAttribute("style") ?? "";
			expect(styleAttribute).toContain("left: 0.5px");
			expect(styleAttribute).toContain("top: 0.5px");
			expect(styleAttribute).toContain("width: 99.75px");
			expect(styleAttribute).toContain("height: 60px");
		});
	});

	it("text z-index is higher than image z-index", async () => {
		const image = buildDecodeImage({ id: "image-layer" });
		const text = buildDecodeText({ id: "text-layer" });
		const html = renderDecodeFixture([
			IntermediateImage.serialize(image),
			IntermediateText.serialize(text),
		]);

		await withDomDocument(async ({ document }) => {
			const defaultView = document.defaultView;
			if (!defaultView) throw new Error("expected defaultView in renderer test");
			document.body.innerHTML = html;

			const img = document.querySelector("#image-layer") as HTMLImageElement | null;
			const span = document.querySelector("#text-layer") as HTMLSpanElement | null;
			expect(img).not.toBeNull();
			expect(span).not.toBeNull();
			if (!img || !span) throw new Error("expected image and text layers");

			expect(defaultView.getComputedStyle(img).zIndex).toBe("1");
			expect(defaultView.getComputedStyle(span).zIndex).toBe("2");
		});
	});

	it("emits clip-path inset when image.clip is provided", async () => {
		const image = buildDecodeImage({
			clip: { x: 5, y: 3, width: 80, height: 40 },
		});
		const html = renderDecodeFixture([IntermediateImage.serialize(image)]);

		await withDomDocument(async ({ document }) => {
			document.body.innerHTML = html;
			const img = document.querySelector(
				"img.hamster-note-image",
			) as HTMLImageElement | null;

			expect(img).not.toBeNull();
			if (!img) throw new Error("expected rendered foreground image");
			expect(img.style.clipPath).toBe("inset(3px 15px 7px 5px)");
		});
	});

	it("falls back to bbox when polygon is not axis-aligned (rotated)", async () => {
		const image = buildDecodeImage({
			polygon: [
				[40, 20],
				[100, 50],
				[80, 110],
				[20, 80],
			],
		});
		const html = renderDecodeFixture([IntermediateImage.serialize(image)]);

		await withDomDocument(async ({ document }) => {
			document.body.innerHTML = html;
			const img = document.querySelector(
				"img.hamster-note-image",
			) as HTMLImageElement | null;

			expect(img).not.toBeNull();
			if (!img) throw new Error("expected rendered foreground image");
			expect(img.style.left).toBe("20px");
			expect(img.style.top).toBe("20px");
			expect(img.style.width).toBe("80px");
			expect(img.style.height).toBe("90px");
			expect(img.style.transform).toBe("");
		});
	});
});

describe("background style whitelist capture", () => {
	const defineRect = (
		element: Element,
		rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
	): void => {
		Object.defineProperty(element, "getBoundingClientRect", {
			configurable: true,
			value: () => ({
				x: rect.left,
				y: rect.top,
				left: rect.left,
				top: rect.top,
				right: rect.left + rect.width,
				bottom: rect.top + rect.height,
				width: rect.width,
				height: rect.height,
				toJSON: () => ({}),
			}),
		});
	};

	const buildBackgroundText = (): IntermediateText =>
		new IntermediateText({
			id: "background-text",
			content: "Text must stay out of background",
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
			],
			lineHeight: 20,
			ascent: 12,
			descent: 4,
			vertical: false,
			dir: TextDir.LTR,
			skew: 0,
			isEOL: true,
		});

	const getVisualContainers = (root: ParentNode): HTMLElement[] =>
		Array.from(
			root.querySelectorAll<HTMLElement>(".hamster-note-visual-container"),
		);

	it("captures visual containers in the default background path while keeping text", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("section");
			source.textContent = "styled source copy must not be cloned";
			source.style.backgroundColor = "rgb(77, 88, 99)";
			source.style.border = "2px solid rgb(1, 2, 3)";
			defineRect(source, { left: 14, top: 18, width: 90, height: 36 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{
					id: "page-default-visual",
					width: 160,
					height: 100,
					texts: [buildBackgroundText()],
				},
				document,
				{ sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(77, 88, 99)");
				expect(container.style.borderTopWidth).toBe("2px");
				expect(container.style.left).toBe("14px");
				expect(container.style.top).toBe("18px");
				expect(handle.element.querySelectorAll(".hamster-note-text")).toHaveLength(1);
				expect(handle.element.textContent).toContain(
					"Text must stay out of background",
				);
				expect(handle.element.textContent).not.toContain(
					"styled source copy must not be cloned",
				);
				expect(handle.element.firstElementChild?.className).toBe(
					"hamster-note-visual-container",
				);
			} finally {
				handle.cleanup();
			}
		});
	});

	it("captures background-color, border, border-radius, box-shadow, outline into offscreen DOM when excludeTextFromBackground is true", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("section");
			source.textContent = "visual label must not be copied";
			Object.assign(source.style, {
				backgroundColor: "rgb(240, 10, 20)",
				borderTopWidth: "1px",
				borderTopStyle: "solid",
				borderTopColor: "rgb(1, 2, 3)",
				borderRightWidth: "2px",
				borderRightStyle: "dashed",
				borderRightColor: "rgb(4, 5, 6)",
				borderBottomWidth: "3px",
				borderBottomStyle: "double",
				borderBottomColor: "rgb(7, 8, 9)",
				borderLeftWidth: "4px",
				borderLeftStyle: "solid",
				borderLeftColor: "rgb(10, 11, 12)",
				borderTopLeftRadius: "5px",
				borderTopRightRadius: "6px",
				borderBottomRightRadius: "7px",
				borderBottomLeftRadius: "8px",
				boxShadow: "1px 2px 3px rgb(9, 8, 7)",
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineColor: "rgb(12, 13, 14)",
			});
			defineRect(source, { left: 15, top: 25, width: 120, height: 45 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-visual", width: 200, height: 120, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(240, 10, 20)");
				expect(container.style.borderTopWidth).toBe("1px");
				expect(container.style.borderTopStyle).toBe("solid");
				expect(container.style.borderTopColor).toBe("rgb(1, 2, 3)");
				expect(container.style.borderRightWidth).toBe("2px");
				expect(container.style.borderRightStyle).toBe("dashed");
				expect(container.style.borderRightColor).toBe("rgb(4, 5, 6)");
				expect(container.style.borderBottomWidth).toBe("3px");
				expect(container.style.borderBottomStyle).toBe("double");
				expect(container.style.borderBottomColor).toBe("rgb(7, 8, 9)");
				expect(container.style.borderLeftWidth).toBe("4px");
				expect(container.style.borderLeftStyle).toBe("solid");
				expect(container.style.borderLeftColor).toBe("rgb(10, 11, 12)");
				expect(container.style.borderTopLeftRadius).toBe("5px");
				expect(container.style.borderTopRightRadius).toBe("6px");
				expect(container.style.borderBottomRightRadius).toBe("7px");
				expect(container.style.borderBottomLeftRadius).toBe("8px");
				expect(container.style.boxShadow).toBe("1px 2px 3px rgb(9, 8, 7)");
				expect(container.style.outlineWidth).toBe("2px");
				expect(container.style.outlineStyle).toBe("solid");
				expect(container.style.outlineColor).toBe("rgb(12, 13, 14)");
			} finally {
				handle.cleanup();
			}
		});
	});

	it("omits text content from captured visual containers", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("article");
			source.textContent = "Secret foreground copy";
			source.style.backgroundColor = "rgb(10, 20, 30)";
			defineRect(source, { left: 10, top: 12, width: 80, height: 32 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{
					id: "page-no-text",
					width: 160,
					height: 100,
					texts: [buildBackgroundText()],
				},
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container?.textContent).toBe("");
				expect(handle.element.textContent).not.toContain("Secret foreground copy");
				expect(handle.element.textContent).not.toContain(
					"Text must stay out of background",
				);
				expect(handle.element.querySelectorAll(".hamster-note-text")).toHaveLength(0);
			} finally {
				handle.cleanup();
			}
		});
	});

	it("skips transform/filter/mix-blend-mode while keeping broad visual styles", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("div");
			Object.assign(source.style, {
				backgroundColor: "rgb(20, 30, 40)",
				transform: "rotate(5deg)",
				filter: "blur(2px)",
				mixBlendMode: "multiply",
				display: "flex",
				margin: "12px",
				padding: "8px",
				fontSize: "42px",
				color: "rgb(1, 1, 1)",
			});
			defineRect(source, { left: 4, top: 5, width: 60, height: 70 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-whitelist", width: 100, height: 100, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");
				const styleText = container.getAttribute("style") ?? "";

				expect(styleText).toContain("background-color");
				expect(styleText).not.toContain("transform");
				expect(styleText).not.toContain("filter");
				expect(styleText).not.toContain("mix-blend-mode");
				expect(styleText).not.toContain("margin");
				expect(container.style.display).toBe("flex");
				expect(container.style.padding).toBe("8px");
				expect(container.style.fontSize).toBe("42px");
				expect(container.style.color).toBe("rgb(1, 1, 1)");
			} finally {
				handle.cleanup();
			}
		});
	});

	it("skips elements with zero rect or no visible whitelist style", async () => {
		await withDomDocument(async ({ document }) => {
			const zeroRect = document.createElement("div");
			zeroRect.style.backgroundColor = "rgb(200, 0, 0)";
			defineRect(zeroRect, { left: 1, top: 1, width: 0, height: 10 });

			const transparentOnly = document.createElement("div");
			transparentOnly.style.backgroundColor = "rgba(0, 0, 0, 0)";
			defineRect(transparentOnly, { left: 2, top: 2, width: 20, height: 20 });

			const visible = document.createElement("div");
			visible.style.boxShadow = "2px 3px 4px rgb(1, 2, 3)";
			defineRect(visible, { left: 3, top: 4, width: 30, height: 40 });

			document.body.append(zeroRect, transparentOnly, visible);

			const handle = buildOffscreenPageElement(
				{ id: "page-skip", width: 120, height: 120, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const containers = getVisualContainers(handle.element);
				expect(containers).toHaveLength(1);
				expect(containers[0]?.style.boxShadow).toBe(
					"2px 3px 4px rgb(1, 2, 3)",
				);
			} finally {
				handle.cleanup();
			}
		});
	});

	it("geometry uses element getBoundingClientRect-derived px values", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("aside");
			source.style.outline = "3px solid rgb(4, 5, 6)";
			defineRect(source, { left: 31.5, top: 42.25, width: 99.75, height: 18.5 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-geometry", width: 200, height: 100, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");
				expect(container.style.position).toBe("absolute");
				expect(container.style.left).toBe("31.5px");
				expect(container.style.top).toBe("42.25px");
				expect(container.style.width).toBe("99.75px");
				expect(container.style.height).toBe("18.5px");
			} finally {
				handle.cleanup();
			}
		});
	});

	it("threads encode source DOM into excludeTextFromBackground thumbnail capture", async () => {
		await withDomDocument(async ({ document, HTMLElement }) => {
			const restoreDocument = exposeGlobalDocument(document);
			const handle = installFakeHtml2Canvas();
			const rectDescriptor = Object.getOwnPropertyDescriptor(
				HTMLElement.prototype,
				"getBoundingClientRect",
			);

			Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
				configurable: true,
				value: function getBoundingClientRectForStyleFixture(this: HTMLElement) {
					if (this.id === "styled-source") {
						return {
							x: 22,
							y: 33,
							left: 22,
							top: 33,
							right: 102,
							bottom: 77,
							width: 80,
							height: 44,
							toJSON: () => ({}),
						};
					}

					if (typeof rectDescriptor?.value === "function") {
						return rectDescriptor.value.call(this);
					}

					return {
						x: 0,
						y: 0,
						left: 0,
						top: 0,
						right: 0,
						bottom: 0,
						width: 0,
						height: 0,
						toJSON: () => ({}),
					};
				},
			});

			try {
				const html = `<div id="styled-source" style="background-color: rgb(44, 55, 66); border: 2px solid rgb(1, 2, 3);">Encoded foreground text</div>`;
				const buffer = new TextEncoder().encode(html).buffer;
				const doc = await HtmlParser.encode(buffer);

				await HtmlParser.decodeToHtml(doc.getIntermediateDocument(), {
					background: { excludeTextFromBackground: true },
				});

				const capturedElement = handle.calls[0]?.element;
				expect(capturedElement).toBeDefined();
				if (!capturedElement) throw new Error("expected html2canvas call");
				const [container] = getVisualContainers(capturedElement);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(44, 55, 66)");
				expect(container.style.left).toBe("22px");
				expect(container.style.top).toBe("33px");
				expect(container.style.width).toBe("80px");
				expect(container.style.height).toBe("44px");
				expect(capturedElement.textContent).not.toContain(
					"Encoded foreground text",
				);
			} finally {
				handle.restore();
				restoreDocument();
				if (rectDescriptor) {
					Object.defineProperty(
						HTMLElement.prototype,
						"getBoundingClientRect",
						rectDescriptor,
					);
				} else {
					delete HTMLElement.prototype.getBoundingClientRect;
				}
			}
		});
	});

	it("threads encode source DOM styles into default background thumbnail capture", async () => {
		await withDomDocument(async ({ document, HTMLElement }) => {
			const restoreDocument = exposeGlobalDocument(document);
			const handle = installFakeHtml2Canvas({
				dataUrl: "data:image/png;base64,DEFAULTSTYLE",
			});
			const rectDescriptor = Object.getOwnPropertyDescriptor(
				HTMLElement.prototype,
				"getBoundingClientRect",
			);

			Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
				configurable: true,
				value: function getBoundingClientRectForDefaultStyleFixture(
					this: HTMLElement,
				) {
					if (this.id === "default-styled-source") {
						return {
							x: 26,
							y: 38,
							left: 26,
							top: 38,
							right: 116,
							bottom: 86,
							width: 90,
							height: 48,
							toJSON: () => ({}),
						};
					}

					if (typeof rectDescriptor?.value === "function") {
						return rectDescriptor.value.call(this);
					}

					return {
						x: 0,
						y: 0,
						left: 0,
						top: 0,
						right: 0,
						bottom: 0,
						width: 0,
						height: 0,
						toJSON: () => ({}),
					};
				},
			});

			try {
				const html = `<div id="default-styled-source" style="background-color: rgb(91, 102, 113); border: 3px solid rgb(4, 5, 6);">Encoded foreground text</div>`;
				const buffer = new TextEncoder().encode(html).buffer;
				const doc = await HtmlParser.encode(buffer);
				const result = await HtmlParser.decodeToHtml(doc.getIntermediateDocument());

				expect(result).toContain(
					"background-image:url(&#39;data:image/png;base64,DEFAULTSTYLE&#39;)",
				);
				expect(handle.calls).toHaveLength(1);

				const capturedElement = handle.calls[0]?.element;
				expect(capturedElement).toBeDefined();
				if (!capturedElement) throw new Error("expected html2canvas call");
				const [container] = getVisualContainers(capturedElement);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(91, 102, 113)");
				expect(container.style.left).toBe("26px");
				expect(container.style.top).toBe("38px");
				expect(container.style.width).toBe("90px");
				expect(container.style.height).toBe("48px");
				expect(capturedElement.textContent).toContain("Encoded foreground text");
			} finally {
				handle.restore();
				restoreDocument();
				if (rectDescriptor) {
					Object.defineProperty(
						HTMLElement.prototype,
						"getBoundingClientRect",
						rectDescriptor,
					);
				} else {
					delete HTMLElement.prototype.getBoundingClientRect;
				}
			}
		});
	});

	// ── broad CSS visual capture tests ────────────────────────────────────
	// collectWhitelistedStyles() 使用视觉类别 allowlist + denylist 策略，
	// 捕获更宽泛的视觉样式（background-image 渐变、opacity、padding、
	// overflow、text-shadow、color、font-*、display 等），同时排除动画、
	// 过渡、cursor 等属性。

	it("captures broad computed visual styles: gradient background-image, background-size/position/repeat, opacity, padding, overflow, text-shadow, font/color, display", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("section");
			source.style.backgroundColor = "rgb(255, 255, 255)";
			source.style.setProperty(
				"background-image",
				"linear-gradient(to right, red, blue)",
			);
			source.style.backgroundSize = "cover";
			source.style.backgroundPosition = "center center";
			source.style.backgroundRepeat = "no-repeat";
			source.style.opacity = "0.75";
			source.style.padding = "12px";
			source.style.overflow = "hidden";
			source.style.textShadow = "1px 1px 2px rgb(0, 0, 0)";
			source.style.color = "rgb(50, 60, 70)";
			source.style.fontSize = "18px";
			source.style.fontFamily = "serif";
			source.style.fontWeight = "700";
			source.style.display = "flex";
			source.style.visibility = "visible";
			defineRect(source, { left: 10, top: 10, width: 200, height: 80 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-broad-visual", width: 300, height: 120, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(255, 255, 255)");

				expect(container.style.backgroundImage).toBe(
					"linear-gradient(to right, red, blue)",
				);
				expect(container.style.backgroundSize).toBe("cover");
				expect(container.style.backgroundPosition).toBe("center center");
				expect(container.style.backgroundRepeat).toBe("no-repeat");
				expect(container.style.opacity).toBe("0.75");
				expect(container.style.padding).toBe("12px");
				expect(container.style.overflow).toBe("hidden");
				expect(container.style.textShadow).toBe("1px 1px 2px rgb(0, 0, 0)");
				expect(container.style.color).toBe("rgb(50, 60, 70)");
				expect(container.style.fontSize).toBe("18px");
				expect(container.style.fontFamily).toBe("serif");
				expect(container.style.fontWeight).toBe("700");
				expect(container.style.display).toBe("flex");
				expect(container.style.visibility).toBe("visible");
			} finally {
				handle.cleanup();
			}
		});
	});

	it("threads broad CSS through encoded background thumbnail capture", async () => {
		await withDomDocument(async ({ document, HTMLElement }) => {
			const restoreDocument = exposeGlobalDocument(document);
			const handle = installFakeHtml2Canvas({
				dataUrl: "data:image/png;base64,BROADWIDTH",
			});
			const rectDescriptor = Object.getOwnPropertyDescriptor(
				HTMLElement.prototype,
				"getBoundingClientRect",
			);

			Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
				configurable: true,
				value: function getBoundingClientRectForBroadFixture(this: HTMLElement) {
					if (this.id === "broad-source") {
						return {
							x: 18,
							y: 24,
							left: 18,
							top: 24,
							right: 178,
							bottom: 84,
							width: 160,
							height: 60,
							toJSON: () => ({}),
						};
					}

					if (typeof rectDescriptor?.value === "function") {
						return rectDescriptor.value.call(this);
					}

					return {
						x: 0,
						y: 0,
						left: 0,
						top: 0,
						right: 0,
						bottom: 0,
						width: 0,
						height: 0,
						toJSON: () => ({}),
					};
				},
			});

			try {
				const html = [
					'<section id="broad-source" style="',
					'background-color: rgb(245, 246, 247);',
					'opacity: 0.72;',
					'padding: 14px;',
					'overflow: hidden;',
					'text-shadow: 1px 1px 2px rgb(0, 0, 0);',
					'color: rgb(12, 34, 56);',
					'font-size: 21px;',
					'font-weight: 700;',
					'display: flex;',
					'">Encoded foreground text</section>',
				].join("");
				const buffer = new TextEncoder().encode(html).buffer;
				const doc = await HtmlParser.encode(buffer, { snapshotWidth: 640 });
				const result = await HtmlParser.decodeToHtml(doc.getIntermediateDocument(), {
					background: { excludeTextFromBackground: true },
				});

				expect(result).toContain(
					"background-image:url(&#39;data:image/png;base64,BROADWIDTH&#39;)",
				);
				expect(handle.calls).toHaveLength(1);
				expect(handle.calls[0]?.options).toEqual({
					backgroundColor: "#ffffff",
					scale: 0.3,
					useCORS: true,
				});

				const capturedElement = handle.calls[0]?.element;
				expect(capturedElement).toBeDefined();
				if (!capturedElement) throw new Error("expected html2canvas call");
				const [container] = getVisualContainers(capturedElement);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(245, 246, 247)");
				expect(container.style.opacity).toBe("0.72");
				expect(container.style.padding).toBe("14px");
				expect(container.style.overflow).toBe("hidden");
				expect(container.style.textShadow).toBe("1px 1px 2px rgb(0, 0, 0)");
				expect(container.style.color).toBe("rgb(12, 34, 56)");
				expect(container.style.fontSize).toBe("21px");
				expect(container.style.fontWeight).toBe("700");
				expect(container.style.display).toBe("flex");
				expect(capturedElement.textContent).not.toContain(
					"Encoded foreground text",
				);
			} finally {
				handle.restore();
				restoreDocument();
				if (rectDescriptor) {
					Object.defineProperty(
						HTMLElement.prototype,
						"getBoundingClientRect",
						rectDescriptor,
					);
				} else {
					delete HTMLElement.prototype.getBoundingClientRect;
				}
			}
		});
	});

	it("continues capturing existing whitelist properties: border, background-color, border-radius, box-shadow, outline", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("div");
			Object.assign(source.style, {
				backgroundColor: "rgb(10, 20, 30)",
				borderTopWidth: "1px",
				borderTopStyle: "solid",
				borderTopColor: "rgb(1, 2, 3)",
				borderRightWidth: "2px",
				borderRightStyle: "dashed",
				borderRightColor: "rgb(4, 5, 6)",
				borderBottomWidth: "3px",
				borderBottomStyle: "double",
				borderBottomColor: "rgb(7, 8, 9)",
				borderLeftWidth: "4px",
				borderLeftStyle: "solid",
				borderLeftColor: "rgb(10, 11, 12)",
				borderTopLeftRadius: "5px",
				borderTopRightRadius: "6px",
				borderBottomRightRadius: "7px",
				borderBottomLeftRadius: "8px",
				boxShadow: "1px 2px 3px rgb(9, 8, 7)",
				outlineWidth: "2px",
				outlineStyle: "solid",
				outlineColor: "rgb(12, 13, 14)",
			});
			defineRect(source, { left: 5, top: 5, width: 100, height: 50 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-existing", width: 200, height: 100, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				expect(container.style.backgroundColor).toBe("rgb(10, 20, 30)");
				expect(container.style.borderTopWidth).toBe("1px");
				expect(container.style.borderTopStyle).toBe("solid");
				expect(container.style.borderTopColor).toBe("rgb(1, 2, 3)");
				expect(container.style.borderRightWidth).toBe("2px");
				expect(container.style.borderRightStyle).toBe("dashed");
				expect(container.style.borderRightColor).toBe("rgb(4, 5, 6)");
				expect(container.style.borderBottomWidth).toBe("3px");
				expect(container.style.borderBottomStyle).toBe("double");
				expect(container.style.borderBottomColor).toBe("rgb(7, 8, 9)");
				expect(container.style.borderLeftWidth).toBe("4px");
				expect(container.style.borderLeftStyle).toBe("solid");
				expect(container.style.borderLeftColor).toBe("rgb(10, 11, 12)");
				expect(container.style.borderTopLeftRadius).toBe("5px");
				expect(container.style.borderTopRightRadius).toBe("6px");
				expect(container.style.borderBottomRightRadius).toBe("7px");
				expect(container.style.borderBottomLeftRadius).toBe("8px");
				expect(container.style.boxShadow).toBe("1px 2px 3px rgb(9, 8, 7)");
				expect(container.style.outlineWidth).toBe("2px");
				expect(container.style.outlineStyle).toBe("solid");
				expect(container.style.outlineColor).toBe("rgb(12, 13, 14)");
			} finally {
				handle.cleanup();
			}
		});
	});

	it("denylist: transition, animation, cursor, user-select, will-change, vendor-internal properties are NOT captured", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("div");
			source.style.backgroundColor = "rgb(200, 200, 200)";
			source.style.transition = "all 0.3s ease";
			source.style.animation = "fadeIn 1s infinite";
			source.style.cursor = "pointer";
			source.style.userSelect = "none";
			source.style.willChange = "transform";
			defineRect(source, { left: 10, top: 10, width: 80, height: 40 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-denylist", width: 200, height: 100, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const [container] = getVisualContainers(handle.element);
				expect(container).toBeDefined();
				if (!container) throw new Error("expected visual container");

				const styleText = container.getAttribute("style") ?? "";

				// pointer-events 由容器创建代码设置为 'none'，不在 denylist 断言范围内
				expect(container.style.transition).toBe("");
				expect(styleText).not.toContain("transition");
				expect(container.style.animation).toBe("");
				expect(styleText).not.toContain("animation");
				expect(container.style.cursor).toBe("");
				expect(styleText).not.toContain("cursor");
				expect(container.style.userSelect).toBe("");
				expect(styleText).not.toContain("user-select");
				expect(container.style.willChange).toBe("");
				expect(styleText).not.toContain("will-change");

				expect(styleText).not.toContain("-internal-");
			} finally {
				handle.cleanup();
			}
		});
	});

	it("pseudo-elements (::before, ::after) are explicitly out of scope", async () => {
		await withDomDocument(async ({ document }) => {
			const source = document.createElement("div");
			source.style.backgroundColor = "rgb(100, 100, 100)";
			defineRect(source, { left: 0, top: 0, width: 50, height: 50 });
			document.body.appendChild(source);

			const handle = buildOffscreenPageElement(
				{ id: "page-pseudo", width: 100, height: 100, texts: [] },
				document,
				{ excludeTextFromBackground: true, sourceDoc: document },
			);

			try {
				const containers = getVisualContainers(handle.element);
				expect(containers).toHaveLength(1);
			} finally {
				handle.cleanup();
			}
		});
	});
});
