const DTUser = require("../models/dtUser.model");
const AnnotationProject = require("../models/annotationProject.model");
const groqProvider = require("./ai-interview/groq.provider");
const MailService = require("./mail-service/mail-service");
const envConfig = require("../config/envConfig");

class AiRecommendationService {
  constructor(llmProvider = groqProvider, mailService = MailService) {
    this.llmProvider = llmProvider;
    this.mailService = mailService;
  }

  /**
   * Generate AI-powered annotator recommendations for a project
   * @param {string} projectId - The annotation project ID
   * @param {number} maxRecommendations - Maximum number of recommendations to return (default: 10)
   * @returns {Promise<Object>} Recommended annotators with scores
   */
  async getAnnotatorRecommendations(projectId, maxRecommendations = 10) {
    try {
      // Get project details
      const project = await AnnotationProject.findById(projectId)
        .populate('createdBy', 'fullName email')
        .lean();

      if (!project) {
        throw new Error('Project not found');
      }

      // Get eligible annotators (approved status, email verified, etc.)
      const eligibleAnnotators = await this._getEligibleAnnotators(project);

      if (eligibleAnnotators.length === 0) {
        return {
          project: {
            id: project._id,
            name: project.projectName,
            category: project.projectCategory,
            description: project.projectDescription
          },
          recommendations: [],
          summary: "No eligible annotators found for this project"
        };
      }

      // Use AI to score and rank annotators
      const recommendations = await this._scoreAnnotatorsWithAI(project, eligibleAnnotators, maxRecommendations);

      return {
        project: {
          id: project._id,
          name: project.projectName,
          category: project.projectCategory,
          description: project.projectDescription,
          requiredSkills: project.requiredSkills,
          difficultyLevel: project.difficultyLevel,
          minimumExperience: project.minimumExperience,
          languageRequirements: project.languageRequirements
        },
        recommendations,
        summary: `Found ${recommendations.length} recommended annotators based on AI analysis of skills, experience, and project requirements`
      };

    } catch (error) {
      console.error('Error generating annotator recommendations:', error);
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }

  /**
   * Send bulk invitation emails to recommended annotators
   * @param {string} projectId - The annotation project ID
   * @param {Array} annotatorIds - Array of annotator user IDs
   * @param {string} customMessage - Custom message to include in the email (optional)
   * @returns {Promise<Object>} Email sending results
   */
  async sendBulkInvitations(projectId, annotatorIds, customMessage = '') {
    try {
      const project = await AnnotationProject.findById(projectId)
        .populate('createdBy', 'fullName email')
        .lean();

      if (!project) {
        throw new Error('Project not found');
      }

      const annotators = await DTUser.find({
        _id: { $in: annotatorIds },
        isEmailVerified: true,
        annotatorStatus: 'approved'
      }).select('fullName email phone personal_info').lean();

      const emailResults = {
        total: annotatorIds.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const annotator of annotators) {
        try {
          await this._sendInvitationEmail(project, annotator, customMessage);
          emailResults.successful++;
        } catch (emailError) {
          emailResults.failed++;
          emailResults.errors.push({
            annotatorId: annotator._id,
            email: annotator.email,
            error: emailError.message
          });
        }
      }

      return emailResults;

    } catch (error) {
      console.error('Error sending bulk invitations:', error);
      throw new Error(`Failed to send invitations: ${error.message}`);
    }
  }

  /**
   * Get eligible annotators based on project requirements
   * @private
   */
  async _getEligibleAnnotators(project) {
    const filter = {
      isEmailVerified: true,
      annotatorStatus: 'approved',
      role: 'user', // Not admin users
      deleted_at: null
    };

    // Add language requirements filter if specified
    if (project.languageRequirements && project.languageRequirements.length > 0) {
      filter.$or = [
        { 'language_proficiency.native_languages': { $in: project.languageRequirements } },
        { 'language_proficiency.other_languages': { $in: project.languageRequirements } }
      ];
    }

    const annotators = await DTUser.find(filter)
      .populate({
        path: 'userDomains',
        populate: {
          path: 'domain_child',
          select: 'name category'
        }
      })
      .select('fullName email phone personal_info language_proficiency userDomains cv_url experience_info createdAt')
      .lean();

    return annotators;
  }

  /**
   * Use AI to score and rank annotators for the project
   * @private
   */
  async _scoreAnnotatorsWithAI(project, annotators, maxRecommendations) {
    if (!this.llmProvider.isConfigured()) {
      console.warn('AI provider not configured, falling back to basic scoring');
      return this._basicScoring(project, annotators, maxRecommendations);
    }

    const client = this.llmProvider.getClient();
    if (!client) {
      return this._basicScoring(project, annotators, maxRecommendations);
    }

    try {
      const prompt = this._buildRecommendationPrompt(project, annotators);

      const response = await client.chat.completions.create({
        model: this.llmProvider.mainModel || "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an expert AI system for matching annotators to annotation projects. Analyze the project requirements and annotator profiles to provide optimal recommendations with detailed scoring."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const content = this.llmProvider.extractContent(response);
      const aiRecommendations = JSON.parse(content);

      return this._processAIRecommendations(aiRecommendations, annotators, maxRecommendations);

    } catch (error) {
      console.error('Error in AI scoring, falling back to basic scoring:', error);
      return this._basicScoring(project, annotators, maxRecommendations);
    }
  }

  /**
   * Build the AI prompt for annotator recommendations
   * @private
   */
  _buildRecommendationPrompt(project, annotators) {
    const annotatorSummaries = annotators.map(annotator => ({
      id: annotator._id.toString(),
      name: annotator.fullName,
      domains: annotator.userDomains?.map(ud => ud.domain_child?.name).filter(Boolean) || [],
      languages: {
        native: annotator.language_proficiency?.native_languages || [],
        other: annotator.language_proficiency?.other_languages || []
      },
      country: annotator.personal_info?.country || 'Unknown',
      experience: annotator.experience_info || 'No experience data',
      hasResume: Boolean(annotator.cv_url),
      accountAge: annotator.createdAt ? Math.floor((new Date() - new Date(annotator.createdAt)) / (1000 * 60 * 60 * 24)) : 0
    }));

    return `
PROJECT TO MATCH:
- Name: ${project.projectName}
- Category: ${project.projectCategory}
- Description: ${project.projectDescription}
- Required Skills: ${project.requiredSkills?.join(', ') || 'None specified'}
- Difficulty Level: ${project.difficultyLevel}
- Minimum Experience: ${project.minimumExperience}
- Language Requirements: ${project.languageRequirements?.join(', ') || 'None specified'}

AVAILABLE ANNOTATORS:
${JSON.stringify(annotatorSummaries, null, 2)}

TASK:
Analyze each annotator's profile against the project requirements and provide a JSON response with recommendations. Consider:

1. Domain expertise relevance
2. Language compatibility  
3. Experience level alignment
4. Account maturity and reliability indicators
5. Skill set overlap with project requirements

Provide your response in this exact JSON format:
{
  "recommendations": [
    {
      "annotatorId": "annotator_id_here",
      "score": 85,
      "reasoning": "Detailed explanation of why this annotator is recommended",
      "strengths": ["strength1", "strength2"],
      "concerns": ["concern1", "concern2"],
      "domainMatch": 90,
      "languageMatch": 100,
      "experienceMatch": 80
    }
  ]
}

Score each annotator from 0-100 based on their fit for this project. Only include annotators with scores above 60.
`;
  }

  /**
   * Process AI recommendations and merge with annotator data
   * @private
   */
  _processAIRecommendations(aiRecommendations, annotators, maxRecommendations) {
    const annotatorMap = new Map(annotators.map(a => [a._id.toString(), a]));
    
    const recommendations = aiRecommendations.recommendations
      .map(rec => {
        const annotator = annotatorMap.get(rec.annotatorId);
        if (!annotator) return null;

        return {
          annotator: {
            _id: annotator._id,
            fullName: annotator.fullName,
            email: annotator.email,
            phone: annotator.phone,
            country: annotator.personal_info?.country,
            domains: annotator.userDomains?.map(ud => ud.domain_child?.name).filter(Boolean) || [],
            languages: annotator.language_proficiency,
            hasResume: Boolean(annotator.cv_url)
          },
          score: rec.score,
          reasoning: rec.reasoning,
          strengths: rec.strengths || [],
          concerns: rec.concerns || [],
          matches: {
            domain: rec.domainMatch || 0,
            language: rec.languageMatch || 0,
            experience: rec.experienceMatch || 0
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRecommendations);

    return recommendations;
  }

  /**
   * Fallback basic scoring when AI is not available
   * @private
   */
  _basicScoring(project, annotators, maxRecommendations) {
    const scored = annotators.map(annotator => {
      let score = 50; // Base score
      const domains = annotator.userDomains?.map(ud => ud.domain_child?.name).filter(Boolean) || [];
      
      // Domain relevance scoring
      const projectCategory = project.projectCategory.toLowerCase();
      const domainRelevance = domains.some(domain => 
        domain.toLowerCase().includes(projectCategory.split(' ')[0].toLowerCase()) ||
        projectCategory.includes(domain.toLowerCase())
      );
      if (domainRelevance) score += 20;

      // Language compatibility
      if (project.languageRequirements && project.languageRequirements.length > 0) {
        const userLanguages = [
          ...(annotator.language_proficiency?.native_languages || []),
          ...(annotator.language_proficiency?.other_languages || [])
        ];
        const hasRequiredLanguage = project.languageRequirements.some(lang => 
          userLanguages.includes(lang)
        );
        if (hasRequiredLanguage) score += 15;
      } else {
        score += 10; // No language requirement is positive
      }

      // Has resume
      if (annotator.cv_url) score += 10;

      // Account age (reliability indicator)
      if (annotator.createdAt) {
        const accountAge = Math.floor((new Date() - new Date(annotator.createdAt)) / (1000 * 60 * 60 * 24));
        if (accountAge > 30) score += 5;
        if (accountAge > 90) score += 5;
      }

      return {
        annotator: {
          _id: annotator._id,
          fullName: annotator.fullName,
          email: annotator.email,
          phone: annotator.phone,
          country: annotator.personal_info?.country,
          domains,
          languages: annotator.language_proficiency,
          hasResume: Boolean(annotator.cv_url)
        },
        score,
        reasoning: `Basic scoring based on domain relevance (${domainRelevance ? 'Yes' : 'No'}), language compatibility, and profile completeness`,
        strengths: [
          ...(domainRelevance ? ['Relevant domain experience'] : []),
          ...(annotator.cv_url ? ['Has uploaded resume'] : []),
          'Verified and approved annotator'
        ],
        concerns: [
          ...(!domainRelevance ? ['Limited domain experience in project category'] : []),
          ...(!annotator.cv_url ? ['No resume uploaded'] : [])
        ],
        matches: {
          domain: domainRelevance ? 80 : 30,
          language: 70, // Default reasonable match
          experience: 60 // Default reasonable match
        }
      };
    })
    .filter(item => item.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRecommendations);

    return scored;
  }

  /**
   * Send invitation email to a single annotator
   * @private
   */
  async _sendInvitationEmail(project, annotator, customMessage) {
    const projectUrl = `${envConfig.FRONTEND_URL}/dashboard/projects/${project._id}`;
    
    const templateData = {
      annotatorName: annotator.fullName,
      projectName: project.projectName,
      projectCategory: project.projectCategory,
      projectDescription: project.projectDescription,
      customMessage: customMessage || 'Our AI system has identified you as a great match for this project based on your skills and experience.',
      projectUrl,
      payRate: `${project.payRate} ${project.payRateCurrency} ${project.payRateType}`,
      deadline: project.applicationDeadline ? new Date(project.applicationDeadline).toLocaleDateString() : 'Open until filled',
      companyName: 'MyDeepTech',
      supportEmail: 'support@mydeeptech.ng'
    };

    return await this.mailService.sendProjectInvitation(
      annotator.email,
      annotator.fullName,
      templateData
    );
  }
}

module.exports = new AiRecommendationService();