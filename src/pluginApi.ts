/**
 * Public API surface exposed to other Obsidian plugins or to the Feeds Reader
 * command palette.  Only **stable** methods should live here – anything else
 * remains internal until it has proven useful for extension.
 */
export class PluginApi {
  /**
   * Send a user-supplied prompt to the OpenAI Chat Completions API and return
   * the raw text reply.
   *
   * The function intentionally **avoids** any caching so that the caller has
   * full control over prompt engineering and rate-limit handling.
   *
   * @param apiKey      Secret OpenAI API key as entered by the user in Settings.
   * @param temperature Sampling temperature (0 – 2).  Higher = more creative.
   * @param prompt      Full prompt text to send as the **user** message.
   * @param model       Model name, defaults to `gpt-4o-mini`.
   *
   * @returns The assistant response with leading/trailing whitespace trimmed.
   *
   * @throws Error  When the HTTP request fails or the response JSON is
   *                malformed / empty.  The thrown message is already
   *                user-friendly and can be surfaced directly in a notice.
   */
  async fetchChatGPT(
    apiKey: string,
    temperature: number,
    prompt: string,
    model: string = 'gpt-4o-mini'
  ): Promise<string> {
    const body = {
      model, // Use the provided model
      messages: [{ role: 'user', content: prompt }],
      temperature,
      // max_tokens: 1000, // Consider adding max_tokens if summaries are too long or costly
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorBodyText = 'Could not retrieve error details from OpenAI API response.';
      try {
        errorBodyText = await res.text();
      } catch (e) {
        console.warn(
          'PluginApi.fetchChatGPT: Failed to parse error body from OpenAI API response.',
          e
        );
      }
      console.error(
        'PluginApi.fetchChatGPT: OpenAI API Error. Status:',
        res.status,
        'Response Body:',
        errorBodyText
      );
      let errorMessage = `OpenAI API request failed (Status: ${res.status}).`;
      if (res.status === 401) {
        errorMessage =
          'OpenAI API request failed: Authentication error (401). Please check your API key in settings.';
      } else if (res.status === 429) {
        errorMessage =
          'OpenAI API request failed: Rate limit exceeded or quota reached (429). Please check your OpenAI account status or try again later.';
      } else if (errorBodyText.toLowerCase().includes('model_not_found')) {
        errorMessage = `OpenAI API request failed: Model "${model}" not found or not accessible with your API key. Please check the model name in settings.`;
      }
      throw new Error(`${errorMessage} (Details: ${errorBodyText.substring(0, 200)}...)`);
    }
    const json = await res.json();
    if (
      !json.choices ||
      json.choices.length === 0 ||
      !json.choices[0].message ||
      !json.choices[0].message.content
    ) {
      console.error(
        'PluginApi.fetchChatGPT: OpenAI API Error - Invalid response structure. Full response:',
        json
      );
      throw new Error(
        'OpenAI API error: Received an invalid or empty response structure from the API. The model might not have generated a reply.'
      );
    }
    return json.choices[0].message.content.trim();
  }
}
