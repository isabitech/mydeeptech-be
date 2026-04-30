const OpenAI = require("openai");
const envConfig = require("../../config/envConfig");
const { AI_AGENTS, GROQ_PROVIDER } = require("./constants");

class GroqProvider {
  constructor(config = envConfig.ai) {
    this.apiKey = config.GROQ_API_KEY;
    this.baseURL = config.AI_BASE_URL;
    this.mainModel = config.AI_MODEL_MAIN;
    this.scoreModel = config.AI_MODEL_SCORE;
    this.promptVersion = config.AI_PROMPT_VERSION;
    this.client = null;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  getPromptVersion() {
    return this.promptVersion;
  }

  getClient() {
    if (!this.isConfigured()) {
      return null;
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });
    }

    return this.client;
  }

  extractContent(response) {
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => item?.text || item?.content || "")
        .join("")
        .trim();
    }

    return "{}";
  }

  parseJson(content) {
    if (!content) {
      return {};
    }

    try {
      return JSON.parse(content);
    } catch (_error) {
      const startIndex = content.indexOf("{");
      const endIndex = content.lastIndexOf("}");
      if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
        throw new Error("LLM did not return valid JSON");
      }

      const candidate = content.slice(startIndex, endIndex + 1);
      return JSON.parse(candidate);
    }
  }

  async createJsonCompletion({
    agent,
    model,
    messages,
    temperature = 0.2,
    maxTokens = 900,
  }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Groq API key is not configured");
    }

    const startedAt = Date.now();
    
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });

      const latencyMs = Date.now() - startedAt;
      const rawContent = this.extractContent(response);
      const data = this.parseJson(rawContent);

      return {
        data,
        rawContent,
        metadata: {
          agent,
          provider: GROQ_PROVIDER,
          model,
          promptVersion: this.promptVersion,
          latencyMs,
          tokensUsed: response?.usage?.total_tokens || 0,
          promptTokens: response?.usage?.prompt_tokens || 0,
          completionTokens: response?.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      // Check if this is a rate limit error
      if (this.isRateLimitError(error)) {
        const userFriendlyError = new Error(
          "Our AI system is currently experiencing high demand. Please wait a moment and try again."
        );
        userFriendlyError.code = 'AI_RATE_LIMIT';
        userFriendlyError.retryAfter = this.extractRetryAfter(error);
        throw userFriendlyError;
      }
      
      // For other API errors, provide a generic message
      if (error?.response?.status >= 400) {
        const userFriendlyError = new Error(
          "Our AI system is temporarily unavailable. Please try again shortly."
        );
        userFriendlyError.code = 'AI_SERVICE_ERROR';
        throw userFriendlyError;
      }
      
      // Re-throw other errors as-is
      throw error;
    }
  }

  generateInterviewQuestion({ messages }) {
    return this.createJsonCompletion({
      agent: AI_AGENTS.INTERVIEWER,
      model: this.mainModel,
      messages,
      temperature: 0.35,
      maxTokens: 500,
    });
  }

  scoreAnswer({ messages }) {
    return this.createJsonCompletion({
      agent: AI_AGENTS.SCORER,
      model: this.scoreModel,
      messages,
      temperature: 0.1,
      maxTokens: 700,
    });
  }

  generateReport({ messages }) {
    return this.createJsonCompletion({
      agent: AI_AGENTS.REPORTER,
      model: this.mainModel,
      messages,
      temperature: 0.2,
      maxTokens: 900,
    });
  }

  parseResume({ messages }) {
    return this.createJsonCompletion({
      agent: AI_AGENTS.RESUME_PARSER,
      model: this.mainModel,
      messages,
      temperature: 0.1,
      maxTokens: 700,
    });
  }

  generateProjectTrack({ messages }) {
    return this.createJsonCompletion({
      agent: AI_AGENTS.PROJECT_TRACK_BUILDER,
      model: this.mainModel,
      messages,
      temperature: 0.2,
      maxTokens: 1200,
    });
  }

  assessFocusLoss({ messages }) {
    return this.createJsonCompletion({
      agent: AI_AGENTS.FOCUS_REVIEWER,
      model: this.mainModel,
      messages,
      temperature: 0.1,
      maxTokens: 500,
    });
  }

  /**
   * Check if error is a rate limit error from Groq API
   * @param {Error} error - The error object
   * @returns {boolean} - Whether this is a rate limit error
   */
  isRateLimitError(error) {
    return (
      error?.code === 'rate_limit_exceeded' ||
      error?.response?.status === 429 ||
      (error?.message && error.message.toLowerCase().includes('rate limit'))
    );
  }

  /**
   * Extract retry after time from rate limit error
   * @param {Error} error - The error object
   * @returns {number|null} - Retry after time in seconds
   */
  extractRetryAfter(error) {
    // Try to extract from error message
    if (error?.message) {
      const match = error.message.match(/try again in ([0-9.]+)s/);
      if (match) {
        return Math.ceil(parseFloat(match[1]));
      }
    }
    
    // Try to extract from headers
    if (error?.response?.headers?.['retry-after']) {
      return parseInt(error.response.headers['retry-after']);
    }
    
    // Default fallback
    return 10;
  }
}

module.exports = new GroqProvider();
