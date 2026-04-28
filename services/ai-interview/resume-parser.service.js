const path = require("node:path");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const AiInterviewAssetRepository = require("../../repositories/aiInterviewAsset.repository");
const groqProvider = require("./groq.provider");
const { buildResumeParsingPrompt } = require("./prompts");
const {
  MAX_RESUME_TEXT_CHARS,
  MAX_STORED_RESUME_TEXT_CHARS,
} = require("./constants");

class ResumeParserService {
  constructor(assetRepository = AiInterviewAssetRepository, llmProvider = groqProvider) {
    this.assetRepository = assetRepository;
    this.llmProvider = llmProvider;
  }

  normalizeText(text = "", maxLength = MAX_STORED_RESUME_TEXT_CHARS) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  normalizeFileName(fileName = "", fileUrl = "") {
    if (fileName) {
      return String(fileName).trim();
    }

    if (!fileUrl) {
      return "";
    }

    try {
      const parsedUrl = new URL(fileUrl);
      return decodeURIComponent(path.basename(parsedUrl.pathname));
    } catch (_error) {
      return path.basename(fileUrl);
    }
  }

  buildProfileSummary(user) {
    return {
      userId: String(user?._id || ""),
      fullName: user?.fullName || "",
      email: user?.email || "",
      role: user?.role || "",
      annotatorStatus: user?.annotatorStatus || "",
      qaStatus: user?.qaStatus || "",
      domains: user?.project_preferences?.domains_of_interest || user?.domains || [],
      yearsOfExperience:
        user?.professional_background?.years_of_experience || 0,
      educationField: user?.professional_background?.education_field || "",
      annotationSkills: user?.annotation_skills || [],
      annotationExperienceTypes:
        user?.professional_background?.annotation_experience_types || [],
      toolExperience: user?.tool_experience || [],
      primaryLanguage: user?.language_proficiency?.primary_language || "",
      englishFluencyLevel:
        user?.language_proficiency?.english_fluency_level || "",
      otherLanguages: user?.language_proficiency?.other_languages || [],
      availableHoursPerWeek:
        user?.personal_info?.available_hours_per_week || 0,
      country: user?.personal_info?.country || "",
      preferredCommunicationChannel:
        user?.personal_info?.preferred_communication_channel || "",
      resumeUrl: user?.attachments?.resume_url || "",
    };
  }

  extractYearsOfExperience(text = "", fallback = 0) {
    const match = String(text).match(/(\d+)\+?\s+years?/i);
    if (match) {
      return Number(match[1]);
    }

    return fallback || 0;
  }

  extractSkillsFromText(text = "", fallbackSkills = []) {
    const knownSkills = [
      "python",
      "javascript",
      "typescript",
      "node.js",
      "node",
      "react",
      "sql",
      "excel",
      "quality assurance",
      "annotation",
      "data labeling",
      "content moderation",
      "transcription",
      "translation",
      "entity recognition",
      "classification",
      "debugging",
      "prompt evaluation",
      "llm",
      "machine learning",
      "labelbox",
      "scale ai",
      "cvat",
      "appen",
      "toloka",
    ];

    const normalizedText = String(text).toLowerCase();
    const matched = knownSkills.filter((skill) =>
      normalizedText.includes(skill.toLowerCase()),
    );

    return [...new Set([...(fallbackSkills || []), ...matched])].slice(0, 12);
  }

  buildFallbackParsedResume({ user, extractedText = "", source = "profile-summary" }) {
    const profileSummary = this.buildProfileSummary(user);
    const summaryLines = [];

    if (profileSummary.yearsOfExperience) {
      summaryLines.push(
        `${profileSummary.yearsOfExperience} years of relevant experience`,
      );
    }

    if (profileSummary.annotationSkills.length > 0) {
      summaryLines.push(
        `Key skills: ${profileSummary.annotationSkills.slice(0, 5).join(", ")}`,
      );
    }

    if (profileSummary.domains.length > 0) {
      summaryLines.push(
        `Domains of interest: ${profileSummary.domains.slice(0, 4).join(", ")}`,
      );
    }

    const extractedSummary = this.normalizeText(extractedText, 300);

    return {
      headline: profileSummary.educationField
        ? `${profileSummary.educationField} background`
        : profileSummary.role || "Annotator profile",
      yearsOfExperience: this.extractYearsOfExperience(
        extractedText,
        profileSummary.yearsOfExperience,
      ),
      primaryRoles: [
        profileSummary.role,
        ...(profileSummary.annotationExperienceTypes || []),
      ].filter(Boolean).slice(0, 6),
      keySkills: this.extractSkillsFromText(
        extractedText,
        [
          ...(profileSummary.annotationSkills || []),
          ...(profileSummary.toolExperience || []),
        ],
      ),
      notableProjects: [],
      education: [profileSummary.educationField].filter(Boolean),
      certifications: [],
      industries: profileSummary.domains.slice(0, 6),
      strengths: [
        ...(profileSummary.annotationSkills || []).slice(0, 4),
        ...(profileSummary.toolExperience || []).slice(0, 3),
      ].filter(Boolean),
      summary:
        summaryLines.join(". ") ||
        extractedSummary ||
        `${profileSummary.fullName || "Candidate"} profile available from DTUser data.`,
      source,
    };
  }

  normalizeParsedResume(candidate, fallback, source) {
    const asString = (value) => String(value || "").trim();
    const asArray = (value, max = 8) => {
      if (!Array.isArray(value)) {
        return [];
      }

      return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, max);
    };

    const years = Number(candidate?.yearsOfExperience);
    return {
      headline: asString(candidate?.headline) || fallback.headline,
      yearsOfExperience: Number.isFinite(years) ? years : fallback.yearsOfExperience,
      primaryRoles: asArray(candidate?.primaryRoles).length
        ? asArray(candidate?.primaryRoles)
        : fallback.primaryRoles,
      keySkills: asArray(candidate?.keySkills, 12).length
        ? asArray(candidate?.keySkills, 12)
        : fallback.keySkills,
      notableProjects: asArray(candidate?.notableProjects, 6),
      education: asArray(candidate?.education, 6).length
        ? asArray(candidate?.education, 6)
        : fallback.education,
      certifications: asArray(candidate?.certifications, 6),
      industries: asArray(candidate?.industries, 8).length
        ? asArray(candidate?.industries, 8)
        : fallback.industries,
      strengths: asArray(candidate?.strengths, 8).length
        ? asArray(candidate?.strengths, 8)
        : fallback.strengths,
      summary:
        this.normalizeText(candidate?.summary, 600) || fallback.summary,
      source,
    };
  }

  async downloadResume(fileUrl) {
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 20000,
      maxContentLength: 12 * 1024 * 1024,
      maxBodyLength: 12 * 1024 * 1024,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    return {
      buffer: Buffer.from(response.data),
      mimeType: response.headers?.["content-type"] || "",
    };
  }

  isPdf({ fileName, mimeType }) {
    return (
      String(mimeType).toLowerCase().includes("pdf") ||
      String(fileName).toLowerCase().endsWith(".pdf")
    );
  }

  isDocx({ fileName, mimeType }) {
    return (
      String(mimeType)
        .toLowerCase()
        .includes("officedocument.wordprocessingml.document") ||
      String(fileName).toLowerCase().endsWith(".docx")
    );
  }

  isPlainText({ fileName, mimeType }) {
    return (
      String(mimeType).toLowerCase().includes("text/plain") ||
      String(fileName).toLowerCase().endsWith(".txt")
    );
  }

  async extractTextFromBuffer(buffer, { fileName, mimeType }) {
    if (!buffer || !buffer.length) {
      return "";
    }

    if (this.isPdf({ fileName, mimeType })) {
      const parsed = await pdfParse(buffer);
      return this.normalizeText(parsed?.text || "");
    }

    if (this.isDocx({ fileName, mimeType })) {
      const parsed = await mammoth.extractRawText({ buffer });
      return this.normalizeText(parsed?.value || "");
    }

    if (this.isPlainText({ fileName, mimeType })) {
      return this.normalizeText(buffer.toString("utf8"));
    }

    const text = this.normalizeText(
      buffer.toString("utf8").replace(/\u0000/g, " "),
    );

    return text.length >= 40 ? text : "";
  }

  async parseResumeContent({ user, fileUrl, fileName, source }) {
    let mimeType = "";
    let extractedText = "";
    let parseError = "";
    let aiMetadata = {};

    try {
      const downloaded = await this.downloadResume(fileUrl);
      mimeType = downloaded.mimeType;
      extractedText = await this.extractTextFromBuffer(downloaded.buffer, {
        fileName,
        mimeType,
      });
    } catch (error) {
      parseError = error.message || "Failed to download or parse resume file";
    }

    const fallbackParsed = this.buildFallbackParsedResume({
      user,
      extractedText,
      source,
    });

    let parsedProfile = fallbackParsed;
    if (extractedText) {
      try {
        const { data, metadata } = await this.llmProvider.parseResume({
          messages: buildResumeParsingPrompt({
            promptVersion: this.llmProvider.getPromptVersion(),
            profileSummary: this.buildProfileSummary(user),
            extractedText: extractedText.slice(0, MAX_RESUME_TEXT_CHARS),
          }),
        });

        parsedProfile = this.normalizeParsedResume(data, fallbackParsed, source);
        aiMetadata = metadata;
      } catch (error) {
        parseError = parseError || error.message || "LLM resume parsing failed";
      }
    }

    return {
      mimeType,
      extractedText: this.normalizeText(extractedText),
      parsedProfile,
      aiMetadata,
      parseError,
    };
  }

  async ensureResumeAsset({
    user,
    fileUrl,
    fileName,
    source = "profile-resume",
    forceReparse = false,
  }) {
    const normalizedFileName = this.normalizeFileName(fileName, fileUrl);
    let asset = await this.assetRepository.findLatestByUserAndUrl(
      user._id,
      fileUrl,
    );

    if (
      asset &&
      asset.parseStatus === "parsed" &&
      asset.parsedProfile?.summary &&
      !forceReparse
    ) {
      return {
        status: 200,
        asset,
        parsedProfile: asset.parsedProfile,
        resumeName: asset.fileName || normalizedFileName,
        resumeUrl: asset.fileUrl,
      };
    }

    if (!asset) {
      asset = await this.assetRepository.create({
        userId: user._id,
        source,
        fileUrl,
        fileName: normalizedFileName,
        parseStatus: "pending",
      });
    } else {
      asset.source = source;
      asset.fileName = normalizedFileName || asset.fileName;
      asset.parseStatus = "pending";
      asset.parseError = "";
    }

    const parsed = await this.parseResumeContent({
      user,
      fileUrl,
      fileName: normalizedFileName || asset.fileName,
      source,
    });

    asset.fileUrl = fileUrl;
    asset.fileName = normalizedFileName || asset.fileName;
    asset.mimeType = parsed.mimeType || asset.mimeType;
    asset.extractedText = parsed.extractedText;
    asset.parsedProfile = parsed.parsedProfile;
    asset.aiMetadata = parsed.aiMetadata || {};
    asset.lastFetchedAt = new Date();
    asset.parsedAt = new Date();
    asset.parseError = parsed.parseError || "";
    asset.parseStatus =
      parsed.parseError && !parsed.extractedText ? "failed" : "parsed";

    await this.assetRepository.save(asset);

    return {
      status: 200,
      asset,
      parsedProfile: asset.parsedProfile,
      resumeName: asset.fileName,
      resumeUrl: asset.fileUrl,
    };
  }

  async resolveResumeContextForUser({
    user,
    resumeAssetId = "",
    resumeName = "",
    forceReparse = false,
  }) {
    if (resumeAssetId) {
      const asset = await this.assetRepository.findById(resumeAssetId);
      if (!asset) {
        return { status: 404, reason: "resume_asset_not_found" };
      }

      if (String(asset.userId) !== String(user._id)) {
        return { status: 403, reason: "resume_asset_forbidden" };
      }

      return this.ensureResumeAsset({
        user,
        fileUrl: asset.fileUrl,
        fileName: asset.fileName || resumeName,
        source: asset.source || "ai-upload",
        forceReparse,
      });
    }

    const profileResumeUrl = user?.attachments?.resume_url || "";
    if (profileResumeUrl) {
      return this.ensureResumeAsset({
        user,
        fileUrl: profileResumeUrl,
        fileName: resumeName || this.normalizeFileName("", profileResumeUrl),
        source: "profile-resume",
        forceReparse,
      });
    }

    return {
      status: 200,
      asset: null,
      parsedProfile: this.buildFallbackParsedResume({
        user,
        extractedText: "",
        source: "profile-summary",
      }),
      resumeName,
      resumeUrl: "",
    };
  }
}

module.exports = new ResumeParserService();
