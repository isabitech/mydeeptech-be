require("dotenv").config();
const mongoose = require("mongoose");
const slugify = require("slugify");

const DomainCategoryRepository = require("../repositories/domainCategory.repository");
const DomainSubCategoryRepository = require("../repositories/domainSubCategory.repository");
const DomainCategoryChildRepository = require("../repositories/domain-category-child.repository");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourdb";

const slug = (name) =>
  slugify(name, { lower: true, trim: true, strict: true, replacement: "_" });

const data = [
  {
    category: "Computing & Software Engineering",
    subcategories: [
      {
        name: "Software Development",
        children: [
          "Python",
          "JavaScript",
          "Java",
          "C / C++",
          "Go",
          "Rust",
          "PHP",
        ],
      },
      {
        name: "Web Development",
        children: [
          "Frontend (HTML, CSS, React, Vue)",
          "Backend (Node.js, Django, Flask)",
          "APIs & Microservices",
        ],
      },
      {
        name: "Mobile Development",
        children: ["Android", "iOS", "Cross-platform (Flutter, React Native)"],
      },
      {
        name: "Systems & OS",
        children: ["Operating Systems", "Compilers", "Embedded Systems"],
      },
      {
        name: "DevOps & Cloud",
        children: ["AWS / GCP / Azure", "Docker & Kubernetes", "CI/CD"],
      },
      {
        name: "Databases",
        children: ["SQL", "NoSQL", "Data Modeling"],
      },
      {
        name: "Cybersecurity",
        children: ["Network Security", "Application Security", "Cryptography"],
      },
      {
        name: "AI & ML",
        children: [
          "Machine Learning",
          "Deep Learning",
          "Reinforcement Learning",
          "MLOps",
        ],
      },
    ],
  },
  {
    category: "Engineering & Applied Sciences",
    subcategories: [
      {
        name: "Civil Engineering",
        children: [
          "Structural Engineering",
          "Geotechnical Engineering",
          "Transportation Engineering",
        ],
      },
      {
        name: "Mechanical Engineering",
        children: ["Thermodynamics", "Fluid Mechanics", "CAD/CAM"],
      },
      {
        name: "Electrical Engineering",
        children: ["Power Systems", "Electronics", "Control Systems"],
      },
      {
        name: "Chemical Engineering",
        children: ["Process Design", "Materials Science"],
      },
      {
        name: "Robotics",
        children: ["Kinematics", "SLAM", "Sensor Fusion"],
      },
      {
        name: "Manufacturing",
        children: ["Quality Control", "Industrial Automation"],
      },
    ],
  },
  {
    category: "Mathematics & Formal Sciences",
    subcategories: [
      {
        name: "Mathematics",
        children: [
          "Arithmetic",
          "Algebra",
          "Geometry",
          "Trigonometry",
          "Calculus",
          "Linear Algebra",
          "Probability",
          "Statistics",
        ],
      },
      {
        name: "Logic & Formal Reasoning",
        children: ["Propositional Logic", "Predicate Logic"],
      },
    ],
    children: ["Optimization", "Numerical Methods"],
  },
  {
    category: "Natural Sciences",
    subcategories: [
      {
        name: "Physics",
        children: [
          "Classical Mechanics",
          "Quantum Mechanics",
          "Electromagnetism",
        ],
      },
      {
        name: "Chemistry",
        children: [
          "Organic Chemistry",
          "Inorganic Chemistry",
          "Analytical Chemistry",
        ],
      },
      {
        name: "Biology",
        children: ["Molecular Biology", "Genetics", "Ecology"],
      },
      {
        name: "Environmental Science",
        children: ["Climate Science", "Sustainability"],
      },
    ],
    children: ["Astronomy & Space Science"],
  },
  {
    category: "Medicine & Healthcare",
    subcategories: [
      {
        name: "Radiology",
        children: ["X-rays", "CT Scans", "MRI"],
      },
      {
        name: "Pathology",
        children: ["Histology Slides"],
      },
    ],
    children: [
      "General Medicine",
      "Dermatology",
      "Cardiology",
      "Public Health",
      "Medical Research",
      "Clinical Documentation",
    ],
  },
  {
    category: "Arts, Media & Entertainment",
    subcategories: [
      {
        name: "Visual Arts",
        children: ["Painting", "Sculpture", "Digital Art"],
      },
      {
        name: "Design",
        children: ["Graphic Design", "UI/UX Design"],
      },
      {
        name: "Film & Video",
        children: ["Scene Understanding", "Video Editing"],
      },
      {
        name: "Music",
        children: ["Music Theory", "Lyrics Analysis"],
      },
      {
        name: "Literature",
        children: ["Fiction", "Poetry", "Literary Analysis"],
      },
      {
        name: "Gaming",
        children: ["Game Design", "Game Assets"],
      },
    ],
  },
  {
    category: "Business, Economics & Finance",
    subcategories: [
      {
        name: "Economics",
        children: ["Microeconomics", "Macroeconomics"],
      },
      {
        name: "Finance",
        children: ["Accounting", "Investment Analysis", "Banking", "FinTech"],
      },
      {
        name: "Marketing",
        children: ["Digital Marketing", "SEO"],
      },
    ],
    children: [
      "Business Operations",
      "Entrepreneurship",
      "Sales",
      "Supply Chain & Logistics",
    ],
  },
  {
    category: "Law, Governance & Public Policy",
    subcategories: [
      {
        name: "Law",
        children: ["Contract Law", "Criminal Law", "Corporate Law"],
      },
    ],
    children: [
      "Legal Research",
      "Compliance & Regulation",
      "Public Policy",
      "Government Administration",
      "International Relations",
    ],
  },
  {
    category: "Social Sciences & Humanities",
    subcategories: [
      {
        name: "Psychology",
        children: ["Cognitive Psychology", "Behavioral Science"],
      },
      {
        name: "Philosophy",
        children: ["Ethics", "Epistemology"],
      },
      {
        name: "Linguistics",
        children: ["Syntax", "Semantics"],
      },
    ],
    children: ["Sociology", "Anthropology", "History"],
  },
  {
    category: "Education & Academia",
    children: [
      "Primary Education",
      "Secondary Education",
      "Higher Education",
      "Curriculum Design",
      "Assessment & Testing",
      "STEM Education",
      "Language Learning",
    ],
  },
  {
    category: "Language & Communication",
    subcategories: [
      {
        name: "Multilingual Content",
        children: [
          "English",
          "French",
          "Spanish",
          "Arabic",
          "African Languages",
        ],
      },
    ],
    children: [
      "General Language Understanding",
      "Translation",
      "Transcription",
      "Summarization",
      "Grammar & Editing",
    ],
  },
  {
    category: "Computer Vision",
    subcategories: [
      {
        name: "Autonomous Driving",
        children: ["Lane Detection", "Traffic Signs"],
      },
    ],
    children: [
      "Image Classification",
      "Object Detection",
      "Image Segmentation",
      "Facial Recognition",
      "OCR (Text in Images)",
      "Handwriting Recognition",
      "Surveillance & Security",
      "Medical Imaging",
      "Satellite & Aerial Imagery",
    ],
  },
  {
    category: "Industry-Specific Domains",
    subcategories: [
      {
        name: "Agriculture",
        children: ["Crop Detection", "Yield Prediction"],
      },
      {
        name: "Construction",
        children: ["Site Monitoring"],
      },
      {
        name: "Energy",
        children: ["Oil & Gas", "Renewable Energy"],
      },
      {
        name: "Retail",
        children: ["Product Recognition"],
      },
    ],
    children: ["Transportation", "Telecommunications"],
  },
];

const connectDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
};

async function seed() {
  await connectDB();

  try {
    for (const entry of data) {
      const categorySlug = slug(entry.category);
      let category = await DomainCategoryRepository.findBySlug(categorySlug);

      if (!category) {
        category = await DomainCategoryRepository.create({
          name: entry.category,
          slug: categorySlug,
        });
        console.log(`Created category: ${entry.category}`);
      } else {
        console.log(`Category exists, skipping: ${entry.category}`);
      }

      if (entry.subcategories) {
        for (const sub of entry.subcategories) {
          const subSlug = slug(sub.name);
          let subCategory =
            await DomainSubCategoryRepository.findBySlugAndCategory(
              subSlug,
              category._id,
            );

          if (!subCategory) {
            subCategory = await DomainSubCategoryRepository.create({
              name: sub.name,
              slug: subSlug,
              domain_category: category._id,
            });
            console.log(`  Created subcategory: ${sub.name}`);
          } else {
            console.log(`  Subcategory exists, skipping: ${sub.name}`);
          }

          for (const childName of sub.children) {
            const childSlug = slug(childName);
            const existing =
              await DomainCategoryChildRepository.findBySlugAndCategoryAndSubCategory(
                childSlug,
                category._id,
                subCategory._id,
              );

            if (!existing) {
              await DomainCategoryChildRepository.create({
                name: childName,
                slug: childSlug,
                domain_category: category._id,
                domain_sub_category: subCategory._id,
              });
              console.log(`    Created child: ${childName}`);
            } else {
              console.log(`    Child exists, skipping: ${childName}`);
            }
          }
        }
      }

      if (entry.children) {
        for (const childName of entry.children) {
          const childSlug = slug(childName);
          const existing =
            await DomainCategoryChildRepository.findBySlugAndCategoryAndSubCategory(
              childSlug,
              category._id,
              null,
            );

          if (!existing) {
            await DomainCategoryChildRepository.create({
              name: childName,
              slug: childSlug,
              domain_category: category._id,
              domain_sub_category: null,
            });
            console.log(`  Created direct child: ${childName}`);
          } else {
            console.log(`  Direct child exists, skipping: ${childName}`);
          }
        }
      }
    }

    console.log("\nSeeding complete.");
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
