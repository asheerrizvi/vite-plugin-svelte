import { preprocessCSS, resolveConfig, transformWithEsbuild } from 'vite';
import type { ESBuildOptions, InlineConfig, ResolvedConfig } from 'vite';
// eslint-disable-next-line node/no-missing-import
import type { Preprocessor, PreprocessorGroup } from 'svelte/types/compiler/preprocess';
import { mapToRelative, removeLangSuffix } from './utils/sourcemaps';

const supportedStyleLangs = ['css', 'less', 'sass', 'scss', 'styl', 'stylus', 'postcss', 'sss'];
const supportedScriptLangs = ['ts'];

export const lang_sep = '.vite-preprocess.';

export function vitePreprocess(opts?: {
	script?: boolean;
	style?: boolean | InlineConfig | ResolvedConfig;
}) {
	const preprocessor: PreprocessorGroup = {};
	if (opts?.script !== false) {
		preprocessor.script = viteScript().script;
	}
	if (opts?.style !== false) {
		const styleOpts = typeof opts?.style == 'object' ? opts?.style : undefined;
		preprocessor.style = viteStyle(styleOpts).style;
	}
	return preprocessor;
}

function viteScript(): { script: Preprocessor } {
	return {
		async script({ attributes, content, filename = '' }) {
			const lang = attributes.lang as string;
			if (!supportedScriptLangs.includes(lang)) return;
			const { code, map } = await transformWithEsbuild(content, filename, {
				loader: lang as ESBuildOptions['loader'],
				target: 'esnext',
				tsconfigRaw: {
					compilerOptions: {
						// svelte typescript needs this flag to work with type imports
						importsNotUsedAsValues: 'preserve',
						preserveValueImports: true
					}
				}
			});

			mapToRelative(map, filename);

			return {
				code,
				map
			};
		}
	};
}

function viteStyle(config: InlineConfig | ResolvedConfig = {}): {
	style: Preprocessor;
} {
	let transform: CssTransform;
	const style: Preprocessor = async ({ attributes, content, filename = '' }) => {
		const lang = attributes.lang as string;
		if (!supportedStyleLangs.includes(lang)) return;
		if (!transform) {
			let resolvedConfig: ResolvedConfig;
			// @ts-expect-error special prop added if running in v-p-s
			if (style.__resolvedConfig) {
				// @ts-expect-error
				resolvedConfig = style.__resolvedConfig;
			} else if (isResolvedConfig(config)) {
				resolvedConfig = config;
			} else {
				resolvedConfig = await resolveConfig(
					config,
					process.env.NODE_ENV === 'production' ? 'build' : 'serve'
				);
			}
			transform = getCssTransformFn(resolvedConfig);
		}
		const suffix = `${lang_sep}${lang}`;
		const moduleId = `${filename}${suffix}`;
		const { code, map, deps } = await transform(content, moduleId);
		removeLangSuffix(map, suffix);
		mapToRelative(map, filename);
		const dependencies = deps ? Array.from(deps).filter((d) => !d.endsWith(suffix)) : undefined;
		return {
			code,
			map: map ?? undefined,
			dependencies
		};
	};
	// @ts-expect-error tag so can be found by v-p-s
	style.__resolvedConfig = null;
	return { style };
}

type CssTransform = (
	// eslint-disable-next-line no-unused-vars
	code: string,
	// eslint-disable-next-line no-unused-vars
	filename: string
) => Promise<{ code: string; map?: any; deps?: Set<string> }>;

function getCssTransformFn(config: ResolvedConfig): CssTransform {
	return async (code, filename) => {
		return preprocessCSS(code, filename, config);
	};
}

function isResolvedConfig(config: any): config is ResolvedConfig {
	return !!config.inlineConfig;
}
