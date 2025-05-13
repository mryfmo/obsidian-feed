export class PluginApi {
  async fetchChatGPT(
    apiKey: string,
    temperature: number,
    prompt: string,
    model: string = "gpt-4o-mini" // Accept model as a parameter, with a default
  ): Promise<string> {
    const body = {
      model: model, // Use the provided model
      messages: [{ role: "user", content: prompt }],
      temperature: temperature,
      // max_tokens: 1000, // Consider adding max_tokens if summaries are too long or costly
    };

    // console.log("Sending to OpenAI:", JSON.stringify(body, null, 2).substring(0, 500)); // Log request body for debugging, can be verbose

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let errorBodyText = "Could not retrieve error details from OpenAI API response.";
      try {
        errorBodyText = await res.text();
      } catch (e) {
        console.warn("PluginApi.fetchChatGPT: Failed to parse error body from OpenAI API response.", e);
      }
      console.error("PluginApi.fetchChatGPT: OpenAI API Error. Status:", res.status, "Response Body:", errorBodyText);
      let errorMessage = `OpenAI API request failed (Status: ${res.status}).`;
      if (res.status === 401) {
        errorMessage = "OpenAI API request failed: Authentication error (401). Please check your API key in settings.";
      } else if (res.status === 429) {
        errorMessage = "OpenAI API request failed: Rate limit exceeded or quota reached (429). Please check your OpenAI account status or try again later.";
      } else if (errorBodyText.toLowerCase().includes("model_not_found")) {
        errorMessage = `OpenAI API request failed: Model "${model}" not found or not accessible with your API key. Please check the model name in settings.`;    
      }
      throw new Error(errorMessage + ` (Details: ${errorBodyText.substring(0, 200)}...)`);
    }
    const json = await res.json();
    if (!json.choices || json.choices.length === 0 || !json.choices[0].message || !json.choices[0].message.content) {
      console.error("PluginApi.fetchChatGPT: OpenAI API Error - Invalid response structure. Full response:", json);
      throw new Error("OpenAI API error: Received an invalid or empty response structure from the API. The model might not have generated a reply.");
    }
    return json.choices[0].message.content.trim();
  }
}
