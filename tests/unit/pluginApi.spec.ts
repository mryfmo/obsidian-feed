import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginApi } from '../../src/pluginApi';

describe('pluginApi.fetchChatGPT', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('throws on non-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Bad'),
      })
    );
    await expect(new PluginApi().fetchChatGPT('k', 0.7, 'p')).rejects.toThrow();
  });

  it('returns content on OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'yay' } }] }),
      })
    );
    const r = await new PluginApi().fetchChatGPT('k', 0.7, 'p');
    expect(r).toBe('yay');
  });
});
