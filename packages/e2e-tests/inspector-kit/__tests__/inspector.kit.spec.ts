import { getEl, getText, isBuild, page } from '~utils';

describe('inspector-kit', () => {
	it('should render page', async () => {
		expect(await getText('h1')).toBe('Hello Inspector!');
	});
	if (!isBuild) {
		it('should show inspector toggle during dev', async () => {
			await page.waitForLoadState('networkidle');
			expect(await getEl('#svelte-inspector-toggle')).not.toBe(null);
		});
	} else {
		it('should not show inspector toggle during preview', async () => {
			expect(await getEl('#svelte-inspector-toggle')).toBe(null);
		});
	}
});
