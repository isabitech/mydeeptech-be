#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

// Import the AssessmentQuestion model
const AssessmentQuestion = require('../models/assessmentQuestion.model.js');

// Sample questions organized by sections (30 questions per section)
const sampleQuestions = {
  "Comprehension": [
    {
      "id": 1,
      "section": "Comprehension",
      "question": "Artificial Intelligence has improved translation tools significantly, but cultural understanding still requires human input.",
      "options": [
        "Machines struggle with cultural context.",
        "AI is better at translation than humans.",
        "Cultural understanding doesn't matter.",
        "Humans are no longer needed for translation."
      ],
      "answer": "Machines struggle with cultural context."
    },
    {
      "id": 2,
      "section": "Comprehension",
      "question": "The rise of remote work has fundamentally changed how companies operate, requiring new management strategies.",
      "options": [
        "Remote work eliminates all management challenges.",
        "Companies need to adapt their management approaches.",
        "Traditional management works perfectly for remote teams.",
        "Remote work has no impact on company operations."
      ],
      "answer": "Companies need to adapt their management approaches."
    },
    {
      "id": 3,
      "section": "Comprehension",
      "question": "Climate change affects agricultural patterns globally, forcing farmers to adapt their practices.",
      "options": [
        "Agriculture is unaffected by climate change.",
        "Farmers must adjust to changing conditions.",
        "Climate change only affects weather patterns.",
        "Agricultural adaptation is unnecessary."
      ],
      "answer": "Farmers must adjust to changing conditions."
    },
    {
      "id": 4,
      "section": "Comprehension",
      "question": "Digital literacy has become as essential as traditional literacy in modern education systems.",
      "options": [
        "Digital skills are optional in education.",
        "Traditional literacy is more important than digital literacy.",
        "Both digital and traditional literacy are equally important.",
        "Education systems haven't changed with technology."
      ],
      "answer": "Both digital and traditional literacy are equally important."
    },
    {
      "id": 5,
      "section": "Comprehension",
      "question": "Social media platforms influence public opinion but also raise concerns about information accuracy.",
      "options": [
        "Social media has no impact on public opinion.",
        "All information on social media is accurate.",
        "Social media influences opinion but may spread misinformation.",
        "Traditional media is completely replaced by social media."
      ],
      "answer": "Social media influences opinion but may spread misinformation."
    },
    {
      "id": 6,
      "section": "Comprehension",
      "question": "Renewable energy sources are becoming more cost-effective, challenging traditional fossil fuel industries.",
      "options": [
        "Fossil fuels remain the cheapest energy source.",
        "Renewable energy is becoming economically competitive.",
        "Energy costs are unrelated to source type.",
        "Traditional industries face no competition."
      ],
      "answer": "Renewable energy is becoming economically competitive."
    },
    {
      "id": 7,
      "section": "Comprehension",
      "question": "Urban planning must consider population growth and environmental sustainability simultaneously.",
      "options": [
        "Population growth and environment are unrelated planning factors.",
        "Urban planners only focus on population numbers.",
        "Environmental concerns should be ignored in urban planning.",
        "Planners must balance population needs with environmental protection."
      ],
      "answer": "Planners must balance population needs with environmental protection."
    },
    {
      "id": 8,
      "section": "Comprehension",
      "question": "Healthcare technology advances improve patient outcomes but require significant investment in training.",
      "options": [
        "Healthcare technology has no learning curve.",
        "Patient outcomes aren't affected by technology.",
        "Technology advances require staff training to be effective.",
        "Investment in healthcare technology is unnecessary."
      ],
      "answer": "Technology advances require staff training to be effective."
    },
    {
      "id": 9,
      "section": "Comprehension",
      "question": "Global supply chains provide efficiency but create vulnerabilities during international crises.",
      "options": [
        "Global supply chains have no weaknesses.",
        "International crises don't affect supply chains.",
        "Efficiency and vulnerability are both characteristics of global supply chains.",
        "Local supply chains are always less efficient."
      ],
      "answer": "Efficiency and vulnerability are both characteristics of global supply chains."
    },
    {
      "id": 10,
      "section": "Comprehension",
      "question": "Financial technology simplifies banking services while raising new security challenges.",
      "options": [
        "Fintech eliminates all security concerns.",
        "Banking services haven't been simplified by technology.",
        "Technology creates both convenience and new security risks.",
        "Traditional banking has no security issues."
      ],
      "answer": "Technology creates both convenience and new security risks."
    },
    {
      "id": 11,
      "section": "Comprehension",
      "question": "Online learning platforms democratize education access but require self-motivation from learners.",
      "options": [
        "Online learning requires no personal discipline.",
        "Education access hasn't changed with online platforms.",
        "Self-motivation is crucial for online learning success.",
        "Traditional learning requires more motivation than online learning."
      ],
      "answer": "Self-motivation is crucial for online learning success."
    },
    {
      "id": 12,
      "section": "Comprehension",
      "question": "Sustainable business practices often require initial investments but can lead to long-term cost savings.",
      "options": [
        "Sustainable practices always increase costs permanently.",
        "Initial investment may yield future savings.",
        "Business sustainability has no financial impact.",
        "Cost savings from sustainability are immediate."
      ],
      "answer": "Initial investment may yield future savings."
    },
    {
      "id": 13,
      "section": "Comprehension",
      "question": "Automation in manufacturing increases efficiency but may displace traditional workers.",
      "options": [
        "Automation has no effect on employment.",
        "Manufacturing efficiency is unrelated to automation.",
        "Automation can both improve efficiency and affect jobs.",
        "Traditional workers are unaffected by automation."
      ],
      "answer": "Automation can both improve efficiency and affect jobs."
    },
    {
      "id": 14,
      "section": "Comprehension",
      "question": "Data privacy regulations protect consumers but create compliance challenges for businesses.",
      "options": [
        "Privacy regulations have no business impact.",
        "Consumer protection and business compliance challenges coexist.",
        "Businesses face no challenges from privacy laws.",
        "Data privacy only benefits businesses."
      ],
      "answer": "Consumer protection and business compliance challenges coexist."
    },
    {
      "id": 15,
      "section": "Comprehension",
      "question": "Space exploration advances scientific knowledge while requiring massive resource allocation.",
      "options": [
        "Space exploration requires minimal resources.",
        "Scientific advancement and resource requirements are both real aspects.",
        "Space exploration provides no scientific value.",
        "Resource allocation for space research is unnecessary."
      ],
      "answer": "Scientific advancement and resource requirements are both real aspects."
    },
    {
      "id": 16,
      "section": "Comprehension",
      "question": "Telemedicine expands healthcare reach to rural areas but requires reliable internet infrastructure.",
      "options": [
        "Telemedicine works without internet connectivity.",
        "Rural healthcare access hasn't improved with telemedicine.",
        "Infrastructure requirements limit telemedicine's rural effectiveness.",
        "Internet reliability is unimportant for telemedicine."
      ],
      "answer": "Infrastructure requirements limit telemedicine's rural effectiveness."
    },
    {
      "id": 17,
      "section": "Comprehension",
      "question": "Electric vehicles reduce emissions but face charging infrastructure limitations.",
      "options": [
        "Electric vehicles have no environmental benefits.",
        "Charging infrastructure is already perfect everywhere.",
        "Environmental benefits exist alongside infrastructure challenges.",
        "Emissions reduction is impossible with electric vehicles."
      ],
      "answer": "Environmental benefits exist alongside infrastructure challenges."
    },
    {
      "id": 18,
      "section": "Comprehension",
      "question": "Cryptocurrency offers financial innovation but experiences significant price volatility.",
      "options": [
        "Cryptocurrency prices are completely stable.",
        "Financial innovation and price volatility characterize cryptocurrency.",
        "Cryptocurrency offers no innovation.",
        "Price volatility doesn't exist in cryptocurrency markets."
      ],
      "answer": "Financial innovation and price volatility characterize cryptocurrency."
    },
    {
      "id": 19,
      "section": "Comprehension",
      "question": "Smart city technology improves urban services but raises concerns about citizen privacy.",
      "options": [
        "Smart cities have no privacy implications.",
        "Urban services aren't improved by smart technology.",
        "Service improvements and privacy concerns both exist in smart cities.",
        "Citizen privacy is enhanced by smart city technology."
      ],
      "answer": "Service improvements and privacy concerns both exist in smart cities."
    },
    {
      "id": 20,
      "section": "Comprehension",
      "question": "Biotechnology advances medical treatments while requiring extensive safety testing.",
      "options": [
        "Biotechnology needs no safety evaluation.",
        "Medical treatments haven't benefited from biotechnology.",
        "Treatment advances and safety requirements go hand in hand.",
        "Safety testing prevents all medical advancement."
      ],
      "answer": "Treatment advances and safety requirements go hand in hand."
    },
    {
      "id": 21,
      "section": "Comprehension",
      "question": "Social entrepreneurship addresses societal problems through business solutions, blending profit with purpose.",
      "options": [
        "Business and social impact cannot be combined.",
        "Social entrepreneurship focuses only on profit.",
        "Profit and social purpose can coexist in business models.",
        "Societal problems require only government solutions."
      ],
      "answer": "Profit and social purpose can coexist in business models."
    },
    {
      "id": 22,
      "section": "Comprehension",
      "question": "Precision agriculture uses technology to optimize farming, but requires significant technical knowledge.",
      "options": [
        "Farming optimization requires no technical skills.",
        "Technology has no role in modern agriculture.",
        "Agricultural technology demands technical expertise for optimization.",
        "Traditional farming methods are always superior."
      ],
      "answer": "Agricultural technology demands technical expertise for optimization."
    },
    {
      "id": 23,
      "section": "Comprehension",
      "question": "Quantum computing promises revolutionary capabilities but remains technically challenging to implement.",
      "options": [
        "Quantum computing is easy to implement everywhere.",
        "Revolutionary potential and implementation challenges coexist.",
        "Quantum computing offers no advantages over traditional computing.",
        "Technical challenges don't exist in quantum computing."
      ],
      "answer": "Revolutionary potential and implementation challenges coexist."
    },
    {
      "id": 24,
      "section": "Comprehension",
      "question": "Gig economy platforms provide flexible work opportunities while creating concerns about worker protections.",
      "options": [
        "Gig work offers no flexibility benefits.",
        "Worker protection concerns are irrelevant in gig economy.",
        "Flexibility and worker protection issues both exist in gig economy.",
        "Traditional employment offers more flexibility than gig work."
      ],
      "answer": "Flexibility and worker protection issues both exist in gig economy."
    },
    {
      "id": 25,
      "section": "Comprehension",
      "question": "Green building design reduces environmental impact but may increase initial construction costs.",
      "options": [
        "Green building has no environmental benefits.",
        "Construction costs are unaffected by green design.",
        "Environmental benefits may come with higher upfront costs.",
        "Traditional building methods are more expensive than green design."
      ],
      "answer": "Environmental benefits may come with higher upfront costs."
    },
    {
      "id": 26,
      "section": "Comprehension",
      "question": "Digital art marketplaces create new opportunities for artists but raise questions about artwork authenticity.",
      "options": [
        "Digital marketplaces offer no benefits to artists.",
        "Artwork authenticity is never questioned in digital formats.",
        "New opportunities and authenticity concerns coexist in digital art.",
        "Traditional art markets have no authenticity issues."
      ],
      "answer": "New opportunities and authenticity concerns coexist in digital art."
    },
    {
      "id": 27,
      "section": "Comprehension",
      "question": "Personalized medicine tailors treatments to individual patients but requires extensive genetic data analysis.",
      "options": [
        "Personalized medicine uses no genetic information.",
        "Treatment customization is impossible in medicine.",
        "Individual treatment customization demands comprehensive genetic analysis.",
        "Generic treatments are always more effective than personalized ones."
      ],
      "answer": "Individual treatment customization demands comprehensive genetic analysis."
    },
    {
      "id": 28,
      "section": "Comprehension",
      "question": "Virtual reality training programs enhance learning experiences while requiring specialized equipment.",
      "options": [
        "VR training needs no special equipment.",
        "Learning experiences aren't improved by virtual reality.",
        "Enhanced learning comes with equipment requirements.",
        "Traditional training is always more effective than VR training."
      ],
      "answer": "Enhanced learning comes with equipment requirements."
    },
    {
      "id": 29,
      "section": "Comprehension",
      "question": "Circular economy principles reduce waste production but demand fundamental business model changes.",
      "options": [
        "Circular economy increases waste production.",
        "Business models don't need to change for circular economy.",
        "Waste reduction requires significant business model transformation.",
        "Fundamental changes aren't necessary for waste reduction."
      ],
      "answer": "Waste reduction requires significant business model transformation."
    },
    {
      "id": 30,
      "section": "Comprehension",
      "question": "Collaborative robots work alongside humans in factories, improving safety while requiring new training protocols.",
      "options": [
        "Collaborative robots decrease workplace safety.",
        "New training isn't needed for robot collaboration.",
        "Safety improvements and training requirements both exist with collaborative robots.",
        "Human-robot collaboration is impossible in manufacturing."
      ],
      "answer": "Safety improvements and training requirements both exist with collaborative robots."
    }
  ],
  "Vocabulary": [
    {
      "id": 31,
      "section": "Vocabulary",
      "question": "'Resilient' means:",
      "options": ["weak", "able to recover quickly", "fragile", "temporary"],
      "answer": "able to recover quickly"
    },
    {
      "id": 32,
      "section": "Vocabulary",
      "question": "'Pragmatic' means:",
      "options": ["theoretical", "practical and realistic", "idealistic", "complicated"],
      "answer": "practical and realistic"
    },
    {
      "id": 33,
      "section": "Vocabulary",
      "question": "'Ubiquitous' means:",
      "options": ["rare", "present everywhere", "expensive", "ancient"],
      "answer": "present everywhere"
    },
    {
      "id": 34,
      "section": "Vocabulary",
      "question": "'Mitigate' means:",
      "options": ["worsen", "reduce or lessen", "ignore", "complicate"],
      "answer": "reduce or lessen"
    },
    {
      "id": 35,
      "section": "Vocabulary",
      "question": "'Sustainable' means:",
      "options": ["temporary", "able to be maintained long-term", "expensive", "complex"],
      "answer": "able to be maintained long-term"
    },
    {
      "id": 36,
      "section": "Vocabulary",
      "question": "'Innovative' means:",
      "options": ["traditional", "introducing new ideas", "conservative", "repetitive"],
      "answer": "introducing new ideas"
    },
    {
      "id": 37,
      "section": "Vocabulary",
      "question": "'Comprehensive' means:",
      "options": ["incomplete", "thorough and complete", "simple", "partial"],
      "answer": "thorough and complete"
    },
    {
      "id": 38,
      "section": "Vocabulary",
      "question": "'Vulnerable' means:",
      "options": ["protected", "easily hurt or damaged", "strong", "independent"],
      "answer": "easily hurt or damaged"
    },
    {
      "id": 39,
      "section": "Vocabulary",
      "question": "'Concurrent' means:",
      "options": ["sequential", "happening at the same time", "delayed", "finished"],
      "answer": "happening at the same time"
    },
    {
      "id": 40,
      "section": "Vocabulary",
      "question": "'Obsolete' means:",
      "options": ["modern", "no longer in use", "popular", "efficient"],
      "answer": "no longer in use"
    },
    {
      "id": 41,
      "section": "Vocabulary",
      "question": "'Feasible' means:",
      "options": ["impossible", "possible to achieve", "difficult", "expensive"],
      "answer": "possible to achieve"
    },
    {
      "id": 42,
      "section": "Vocabulary",
      "question": "'Transparent' means:",
      "options": ["hidden", "open and honest", "complicated", "secretive"],
      "answer": "open and honest"
    },
    {
      "id": 43,
      "section": "Vocabulary",
      "question": "'Redundant' means:",
      "options": ["necessary", "no longer needed", "important", "unique"],
      "answer": "no longer needed"
    },
    {
      "id": 44,
      "section": "Vocabulary",
      "question": "'Coherent' means:",
      "options": ["confused", "logical and consistent", "scattered", "incomplete"],
      "answer": "logical and consistent"
    },
    {
      "id": 45,
      "section": "Vocabulary",
      "question": "'Ambiguous' means:",
      "options": ["clear", "having multiple meanings", "simple", "definite"],
      "answer": "having multiple meanings"
    },
    {
      "id": 46,
      "section": "Vocabulary",
      "question": "'Efficient' means:",
      "options": ["wasteful", "achieving maximum productivity", "slow", "complicated"],
      "answer": "achieving maximum productivity"
    },
    {
      "id": 47,
      "section": "Vocabulary",
      "question": "'Diverse' means:",
      "options": ["uniform", "showing variety", "similar", "limited"],
      "answer": "showing variety"
    },
    {
      "id": 48,
      "section": "Vocabulary",
      "question": "'Optimal' means:",
      "options": ["worst", "best possible", "average", "minimum"],
      "answer": "best possible"
    },
    {
      "id": 49,
      "section": "Vocabulary",
      "question": "'Prevalent' means:",
      "options": ["rare", "widespread", "hidden", "new"],
      "answer": "widespread"
    },
    {
      "id": 50,
      "section": "Vocabulary",
      "question": "'Intrinsic' means:",
      "options": ["external", "belonging naturally", "artificial", "temporary"],
      "answer": "belonging naturally"
    },
    {
      "id": 51,
      "section": "Vocabulary",
      "question": "'Empirical' means:",
      "options": ["theoretical", "based on observation", "imaginary", "abstract"],
      "answer": "based on observation"
    },
    {
      "id": 52,
      "section": "Vocabulary",
      "question": "'Paradigm' means:",
      "options": ["confusion", "typical example or model", "problem", "solution"],
      "answer": "typical example or model"
    },
    {
      "id": 53,
      "section": "Vocabulary",
      "question": "'Catalyst' means:",
      "options": ["obstacle", "something that causes change", "result", "delay"],
      "answer": "something that causes change"
    },
    {
      "id": 54,
      "section": "Vocabulary",
      "question": "'Indigenous' means:",
      "options": ["foreign", "native to a place", "modern", "artificial"],
      "answer": "native to a place"
    },
    {
      "id": 55,
      "section": "Vocabulary",
      "question": "'Versatile' means:",
      "options": ["limited", "having many uses", "specific", "rigid"],
      "answer": "having many uses"
    },
    {
      "id": 56,
      "section": "Vocabulary",
      "question": "'Preliminary' means:",
      "options": ["final", "introductory", "conclusive", "complete"],
      "answer": "introductory"
    },
    {
      "id": 57,
      "section": "Vocabulary",
      "question": "'Inherent' means:",
      "options": ["added later", "existing naturally", "removable", "external"],
      "answer": "existing naturally"
    },
    {
      "id": 58,
      "section": "Vocabulary",
      "question": "'Meticulous' means:",
      "options": ["careless", "very careful about details", "rushed", "approximate"],
      "answer": "very careful about details"
    },
    {
      "id": 59,
      "section": "Vocabulary",
      "question": "'Unprecedented' means:",
      "options": ["common", "never done before", "repeated", "expected"],
      "answer": "never done before"
    },
    {
      "id": 60,
      "section": "Vocabulary",
      "question": "'Synthesis' means:",
      "options": ["separation", "combination of elements", "analysis", "destruction"],
      "answer": "combination of elements"
    }
  ],
  "Grammar": [
    {
      "id": 61,
      "section": "Grammar",
      "question": "I will send the document after you ___ your review.",
      "options": ["completed", "complete", "have completed", "had completed"],
      "answer": "complete"
    },
    {
      "id": 62,
      "section": "Grammar",
      "question": "The team ___ working on the project for three months.",
      "options": ["has been", "have been", "is been", "are been"],
      "answer": "has been"
    },
    {
      "id": 63,
      "section": "Grammar",
      "question": "Neither the manager nor the employees ___ satisfied with the outcome.",
      "options": ["was", "were", "is", "are"],
      "answer": "were"
    },
    {
      "id": 64,
      "section": "Grammar",
      "question": "She insisted that he ___ the meeting on time.",
      "options": ["attends", "attend", "attended", "will attend"],
      "answer": "attend"
    },
    {
      "id": 65,
      "section": "Grammar",
      "question": "If I ___ you, I would consider the offer carefully.",
      "options": ["am", "was", "were", "be"],
      "answer": "were"
    },
    {
      "id": 66,
      "section": "Grammar",
      "question": "The data ___ been analyzed thoroughly.",
      "options": ["has", "have", "is", "are"],
      "answer": "has"
    },
    {
      "id": 67,
      "section": "Grammar",
      "question": "Each of the participants ___ required to submit a report.",
      "options": ["are", "is", "were", "have"],
      "answer": "is"
    },
    {
      "id": 68,
      "section": "Grammar",
      "question": "The committee ___ reached a unanimous decision.",
      "options": ["has", "have", "are", "were"],
      "answer": "has"
    },
    {
      "id": 69,
      "section": "Grammar",
      "question": "By next year, we ___ completed the expansion project.",
      "options": ["will have", "will", "would have", "had"],
      "answer": "will have"
    },
    {
      "id": 70,
      "section": "Grammar",
      "question": "The number of applications ___ increasing every year.",
      "options": ["are", "is", "were", "have"],
      "answer": "is"
    },
    {
      "id": 71,
      "section": "Grammar",
      "question": "She would rather ___ at home than go to the party.",
      "options": ["stay", "stays", "stayed", "staying"],
      "answer": "stay"
    },
    {
      "id": 72,
      "section": "Grammar",
      "question": "The proposal, along with the budget, ___ approved yesterday.",
      "options": ["were", "was", "are", "is"],
      "answer": "was"
    },
    {
      "id": 73,
      "section": "Grammar",
      "question": "I wish I ___ more time to complete the assignment.",
      "options": ["have", "had", "has", "will have"],
      "answer": "had"
    },
    {
      "id": 74,
      "section": "Grammar",
      "question": "The statistics ___ that customer satisfaction has improved.",
      "options": ["shows", "show", "showing", "shown"],
      "answer": "show"
    },
    {
      "id": 75,
      "section": "Grammar",
      "question": "Either the CEO or the board members ___ to make the final decision.",
      "options": ["has", "have", "is", "are"],
      "answer": "have"
    },
    {
      "id": 76,
      "section": "Grammar",
      "question": "The series of workshops ___ designed to improve productivity.",
      "options": ["were", "was", "are", "is"],
      "answer": "was"
    },
    {
      "id": 77,
      "section": "Grammar",
      "question": "Had I known about the meeting, I ___ attended.",
      "options": ["will have", "would have", "will", "would"],
      "answer": "would have"
    },
    {
      "id": 78,
      "section": "Grammar",
      "question": "The majority of the staff ___ in favor of flexible working hours.",
      "options": ["is", "are", "was", "has"],
      "answer": "are"
    },
    {
      "id": 79,
      "section": "Grammar",
      "question": "It is essential that every employee ___ the safety protocols.",
      "options": ["follows", "follow", "followed", "following"],
      "answer": "follow"
    },
    {
      "id": 80,
      "section": "Grammar",
      "question": "The news about the merger ___ unexpected.",
      "options": ["were", "was", "are", "is"],
      "answer": "was"
    },
    {
      "id": 81,
      "section": "Grammar",
      "question": "Twenty dollars ___ too much for that item.",
      "options": ["are", "is", "were", "have"],
      "answer": "is"
    },
    {
      "id": 82,
      "section": "Grammar",
      "question": "The headquarters ___ located in downtown.",
      "options": ["are", "is", "were", "have"],
      "answer": "is"
    },
    {
      "id": 83,
      "section": "Grammar",
      "question": "Physics ___ my favorite subject in college.",
      "options": ["were", "was", "are", "is"],
      "answer": "was"
    },
    {
      "id": 84,
      "section": "Grammar",
      "question": "The criteria for selection ___ very strict.",
      "options": ["is", "are", "was", "has"],
      "answer": "are"
    },
    {
      "id": 85,
      "section": "Grammar",
      "question": "Not only the students but also the teacher ___ excited about the field trip.",
      "options": ["are", "is", "were", "have"],
      "answer": "is"
    },
    {
      "id": 86,
      "section": "Grammar",
      "question": "The alumni ___ planning a reunion next summer.",
      "options": ["is", "are", "was", "has"],
      "answer": "are"
    },
    {
      "id": 87,
      "section": "Grammar",
      "question": "A number of issues ___ raised during the meeting.",
      "options": ["was", "were", "is", "has"],
      "answer": "were"
    },
    {
      "id": 88,
      "section": "Grammar",
      "question": "The scissors ___ in the drawer.",
      "options": ["is", "are", "was", "has"],
      "answer": "are"
    },
    {
      "id": 89,
      "section": "Grammar",
      "question": "Economics ___ a complex field of study.",
      "options": ["are", "is", "were", "have"],
      "answer": "is"
    },
    {
      "id": 90,
      "section": "Grammar",
      "question": "The staff ___ divided on the new policy.",
      "options": ["is", "are", "was", "has"],
      "answer": "are"
    }
  ],
  "Writing": [
    {
      "id": 91,
      "section": "Writing",
      "question": "Choose the clearest sentence:",
      "options": [
        "Due to the fact that we were late, we missed it.",
        "Because we were late, we missed it.",
        "Since we arrived late, we missed it.",
        "We were late and so missed."
      ],
      "answer": "Because we were late, we missed it."
    },
    {
      "id": 92,
      "section": "Writing",
      "question": "Which sentence is most concise?",
      "options": [
        "In my personal opinion, I believe this is correct.",
        "I believe this is correct.",
        "This is correct, in my opinion.",
        "This is correct."
      ],
      "answer": "This is correct."
    },
    {
      "id": 93,
      "section": "Writing",
      "question": "Choose the sentence with parallel structure:",
      "options": [
        "She likes reading, writing, and to paint.",
        "She likes reading, writing, and painting.",
        "She likes to read, writing, and painting.",
        "She likes reading, to write, and painting."
      ],
      "answer": "She likes reading, writing, and painting."
    },
    {
      "id": 94,
      "section": "Writing",
      "question": "Which sentence avoids wordiness?",
      "options": [
        "At this point in time, we need to make a decision.",
        "We need to make a decision at this time.",
        "We need to decide now.",
        "We need to make a decision right now at this moment."
      ],
      "answer": "We need to decide now."
    },
    {
      "id": 95,
      "section": "Writing",
      "question": "Choose the sentence with active voice:",
      "options": [
        "The report was written by the team.",
        "The team wrote the report.",
        "The report was completed by the team.",
        "The writing of the report was done by the team."
      ],
      "answer": "The team wrote the report."
    },
    {
      "id": 96,
      "section": "Writing",
      "question": "Which sentence has the best flow?",
      "options": [
        "The meeting was productive. However, it was long.",
        "The meeting was productive, but long.",
        "Although the meeting was long, it was productive.",
        "The meeting was long. It was productive though."
      ],
      "answer": "Although the meeting was long, it was productive."
    },
    {
      "id": 97,
      "section": "Writing",
      "question": "Choose the most professional tone:",
      "options": [
        "We're gonna need to chat about this ASAP.",
        "We need to discuss this immediately.",
        "We should probably talk about this soon.",
        "We must convene to deliberate upon this matter forthwith."
      ],
      "answer": "We need to discuss this immediately."
    },
    {
      "id": 98,
      "section": "Writing",
      "question": "Which sentence eliminates redundancy?",
      "options": [
        "We will meet together at 3 PM in the afternoon.",
        "We will meet at 3 PM in the afternoon.",
        "We will meet together at 3 PM.",
        "We will meet at 3 PM."
      ],
      "answer": "We will meet at 3 PM."
    },
    {
      "id": 99,
      "section": "Writing",
      "question": "Choose the sentence with proper modifier placement:",
      "options": [
        "Walking to the store, the rain started.",
        "The rain started while walking to the store.",
        "While walking to the store, I noticed the rain start.",
        "The rain, while walking to the store, started."
      ],
      "answer": "While walking to the store, I noticed the rain start."
    },
    {
      "id": 100,
      "section": "Writing",
      "question": "Which sentence maintains consistency?",
      "options": [
        "First, gather the materials. Then you should prepare the workspace.",
        "First, gather the materials. Then, prepare the workspace.",
        "You should gather the materials first. Then prepare the workspace.",
        "Gather the materials first. Then you prepare the workspace."
      ],
      "answer": "First, gather the materials. Then, prepare the workspace."
    },
    {
      "id": 101,
      "section": "Writing",
      "question": "Choose the sentence that avoids jargon:",
      "options": [
        "We need to leverage our core competencies going forward.",
        "We need to use our main strengths in the future.",
        "We need to utilize our primary capabilities moving forward.",
        "We should leverage our key strengths going forward."
      ],
      "answer": "We need to use our main strengths in the future."
    },
    {
      "id": 102,
      "section": "Writing",
      "question": "Which sentence is most direct?",
      "options": [
        "It would be appreciated if you could possibly consider sending the report.",
        "Could you please send the report?",
        "I would like to request that you send the report.",
        "Please send the report."
      ],
      "answer": "Please send the report."
    },
    {
      "id": 103,
      "section": "Writing",
      "question": "Choose the sentence with clear pronoun reference:",
      "options": [
        "When John met with Bill, he was nervous.",
        "John was nervous when he met with Bill.",
        "When meeting with Bill, John was nervous.",
        "John, when he met Bill, was nervous."
      ],
      "answer": "John was nervous when he met with Bill."
    },
    {
      "id": 104,
      "section": "Writing",
      "question": "Which sentence uses specific language?",
      "options": [
        "Sales increased a lot last quarter.",
        "Sales increased significantly last quarter.",
        "Sales increased by 25% last quarter.",
        "Sales really improved last quarter."
      ],
      "answer": "Sales increased by 25% last quarter."
    },
    {
      "id": 105,
      "section": "Writing",
      "question": "Choose the sentence with varied sentence structure:",
      "options": [
        "The project started. The team worked hard. They finished on time.",
        "The project started, the team worked hard, and they finished on time.",
        "After the project started, the team worked hard and finished on time.",
        "The project started and the team worked hard and finished on time."
      ],
      "answer": "After the project started, the team worked hard and finished on time."
    },
    {
      "id": 106,
      "section": "Writing",
      "question": "Which sentence maintains formal tone?",
      "options": [
        "The results are pretty good, all things considered.",
        "The results are quite satisfactory, considering the circumstances.",
        "The results are awesome, given what we had to work with.",
        "The results are okay, I guess, considering everything."
      ],
      "answer": "The results are quite satisfactory, considering the circumstances."
    },
    {
      "id": 107,
      "section": "Writing",
      "question": "Choose the sentence with effective emphasis:",
      "options": [
        "Quality is important, not speed.",
        "Quality, not speed, is important.",
        "Quality is what's important, not speed.",
        "It's quality that's important, not speed."
      ],
      "answer": "Quality, not speed, is important."
    },
    {
      "id": 108,
      "section": "Writing",
      "question": "Which sentence avoids ambiguity?",
      "options": [
        "The manager told the employee that he needed improvement.",
        "The manager told the employee that the employee needed improvement.",
        "The manager told the employee about needed improvements.",
        "The manager discussed needed improvements with the employee."
      ],
      "answer": "The manager discussed needed improvements with the employee."
    },
    {
      "id": 109,
      "section": "Writing",
      "question": "Choose the sentence with logical flow:",
      "options": [
        "Although we increased marketing, sales declined because of competition.",
        "We increased marketing, but sales declined. This was because of competition.",
        "Despite increased marketing efforts, sales declined due to intense competition.",
        "We increased marketing. Sales declined. Competition was intense."
      ],
      "answer": "Despite increased marketing efforts, sales declined due to intense competition."
    },
    {
      "id": 120,
      "section": "Writing",
      "question": "Which sentence demonstrates strong conclusion writing?",
      "options": [
        "In conclusion, these are some things to consider.",
        "Therefore, implementing these strategies will improve efficiency.",
        "So, that's basically what I think about this topic.",
        "These recommendations should probably be considered."
      ],
      "answer": "Therefore, implementing these strategies will improve efficiency."
    }
  ]
};

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Disconnect from database
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting:', error);
  }
};

// Seed all questions
const seedAllQuestions = async () => {
  try {
    console.log('🌱 Starting question seeding process...');

    // Clear existing questions
    await AssessmentQuestion.deleteMany({});
    console.log('🗑️  Cleared existing questions');

    let totalInserted = 0;

    // Insert questions by section
    for (const [sectionName, questions] of Object.entries(sampleQuestions)) {
      console.log(`📚 Inserting ${questions.length} questions for ${sectionName}...`);
      
      try {
        const result = await AssessmentQuestion.insertMany(questions);
        console.log(`✅ Successfully inserted ${result.length} ${sectionName} questions`);
        totalInserted += result.length;
      } catch (error) {
        console.error(`❌ Error inserting ${sectionName} questions:`, error.message);
      }
    }

    console.log(`\n🎯 Seeding completed! Total questions inserted: ${totalInserted}`);

    // Show summary by section
    const summary = await AssessmentQuestion.aggregate([
      { $group: { _id: '$section', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Questions by section:');
    summary.forEach(item => {
      console.log(`  ${item._id}: ${item.count} questions`);
    });

  } catch (error) {
    console.error('❌ Error during seeding:', error);
  }
};

// List all questions
const listAllQuestions = async () => {
  try {
    const questions = await AssessmentQuestion.find({}).sort({ section: 1, id: 1 });
    
    if (questions.length === 0) {
      console.log('📝 No questions found in database');
      return;
    }

    console.log(`\n📋 Found ${questions.length} questions in database:\n`);
    
    let currentSection = '';
    questions.forEach((q, index) => {
      if (q.section !== currentSection) {
        currentSection = q.section;
        console.log(`\n🔸 ${currentSection} Section:`);
        console.log('─'.repeat(30));
      }
      
      console.log(`${index + 1}. [ID: ${q.id}] ${q.question}`);
      console.log(`   Options: ${q.options.join(' | ')}`);
      console.log(`   Answer: ${q.answer}\n`);
    });

    // Show section summary
    const sectionCounts = await AssessmentQuestion.aggregate([
      { $group: { _id: '$section', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Summary by section:');
    sectionCounts.forEach(item => {
      console.log(`  ${item._id}: ${item.count} questions`);
    });

  } catch (error) {
    console.error('❌ Error listing questions:', error);
  }
};

// Get random sample questions (for testing)
const getRandomSample = async () => {
  try {
    console.log('🎲 Getting random sample questions (5 per section)...\n');
    
    const sections = ['Comprehension', 'Vocabulary', 'Grammar', 'Writing'];
    
    for (const section of sections) {
      const questions = await AssessmentQuestion.aggregate([
        { $match: { section: section, isActive: true } },
        { $sample: { size: 5 } },
        { $project: { id: 1, question: 1, options: 1, answer: 1, _id: 0 } }
      ]);

      console.log(`🔸 ${section} Sample Questions:`);
      questions.forEach((q, index) => {
        console.log(`${index + 1}. [ID: ${q.id}] ${q.question}`);
        console.log(`   Options: ${q.options.join(' | ')}`);
        console.log(`   Answer: ${q.answer}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error getting random sample:', error);
  }
};

// Command line interface
const main = async () => {
  await connectDB();
  
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'seed':
        await seedAllQuestions();
        break;
      case 'list':
        await listAllQuestions();
        break;
      case 'sample':
        await getRandomSample();
        break;
      case 'stats':
        const stats = await AssessmentQuestion.getQuestionCountBySection();
        console.log('📊 Question Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        break;
      default:
        console.log('📖 Assessment Question Seeder');
        console.log('Usage:');
        console.log('  node sectionBasedSeeder.js seed    - Seed all 120 questions (30 per section)');
        console.log('  node sectionBasedSeeder.js list    - List all questions in database');
        console.log('  node sectionBasedSeeder.js sample  - Get random sample (5 per section)');
        console.log('  node sectionBasedSeeder.js stats   - Show question statistics');
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
  } finally {
    await disconnectDB();
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sampleQuestions, connectDB, disconnectDB, seedAllQuestions, listAllQuestions };