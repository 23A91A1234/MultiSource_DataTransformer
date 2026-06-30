/**
 * Unified date-range helper.
 * Extracts start/end dates and the matched substring from a line.
 * @param {string} line 
 * @returns {object} { start: string|null, end: string|null, matchedText: string|null }
 */
export function extractDateRange(line) {
  if (!line) return { start: null, end: null, matchedText: null };

  const monthNameMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // 1. Month YYYY patterns (handles glued word characters like DeveloperMay 2025)
  const monthYearRegex = /(?:\b|[a-z])(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+((?:19|20)\d{2})\b/gi;
  const monthMatches = [...line.matchAll(monthYearRegex)];

  // 2. YYYY-MM or YYYY/MM patterns
  const yyyyMmRegex = /\b((?:19|20)\d{2})[-/](\d{2})\b/g;
  const yyyyMmMatches = [...line.matchAll(yyyyMmRegex)];

  // 3. Bare YYYY patterns
  const yyyyRegex = /\b((?:19|20)\d{2})\b/g;
  const yyyyMatches = [...line.matchAll(yyyyRegex)];

  let datesFound = []; // Elements: { dateStr: 'YYYY-MM', startIdx: number, endIdx: number }

  if (monthMatches.length > 0) {
    monthMatches.forEach(m => {
      const monthName = m[1].toLowerCase().slice(0, 3);
      const monthNum = monthNameMap[monthName] || '01';
      const yearNum = m[2];

      let mStart = m.index;
      const mEnd = m.index + m[0].length;
      // If the match starts with a lowercase letter (glued word character), advance start by 1
      if (!m[0].toLowerCase().startsWith(m[1].toLowerCase())) {
        mStart += 1;
      }
      datesFound.push({
        dateStr: `${yearNum}-${monthNum}`,
        startIdx: mStart,
        endIdx: mEnd
      });
    });
  } else if (yyyyMmMatches.length > 0) {
    yyyyMmMatches.forEach(m => {
      const yearNum = m[1];
      const monthNum = m[2];
      datesFound.push({
        dateStr: `${yearNum}-${monthNum}`,
        startIdx: m.index,
        endIdx: m.index + m[0].length
      });
    });
  } else if (yyyyMatches.length > 0) {
    yyyyMatches.forEach(m => {
      const yearNum = m[1];
      datesFound.push({
        dateStr: `${yearNum}-01`,
        startIdx: m.index,
        endIdx: m.index + m[0].length
      });
    });
  }

  if (datesFound.length === 0) {
    return { start: null, end: null, matchedText: null };
  }

  // Sort by starting index
  datesFound.sort((a, b) => a.startIdx - b.startIdx);

  let start = datesFound[0].dateStr;
  let end = null;
  let minStart = datesFound[0].startIdx;
  let maxEnd = datesFound[datesFound.length - 1].endIdx;

  if (datesFound.length >= 2) {
    end = datesFound[1].dateStr;
  } else {
    // Check if "present" or "current" occurs after the first date
    const remainingText = line.substring(maxEnd).toLowerCase();
    const presentMatch = remainingText.match(/\b(present|current)\b/i);
    if (presentMatch) {
      end = 'Present';
      maxEnd = maxEnd + presentMatch.index + presentMatch[0].length;
    }
  }

  const matchedText = line.substring(minStart, maxEnd);

  return { start, end, matchedText };
}

/**
 * Helper to parse plain text extracted from resumes (PDF or DOCX).
 * Extracts: name, email, phone, links, skills, experience, education.
 * @param {string} text 
 * @returns {object} Extracted fields
 */
export function parseResumeText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // 1. Email Extraction
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];
  const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase()))];

  // 2. Phone Extraction
  // Matches e.g. +1-415-555-1234, (415) 555-1234, 415.555.1234, +14155551234
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = text.match(phoneRegex) || [];
  const uniquePhones = [...new Set(phones)];

  // 3. Name Extraction
  // Often the first line of the resume is the candidate's name.
  // We'll skip lines that contain email, phone, or are very long.
  let name = null;
  for (const line of lines) {
    if (line.includes('@') || line.match(/\d{4}/) || line.toLowerCase().includes('resume') || line.toLowerCase().includes('curriculum')) {
      continue;
    }
    // Check if line looks like a name (2-3 words, capitalized)
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Z]/.test(w) || /^[a-z]/.test(w))) {
      name = line;
      break;
    }
  }
  if (!name && lines.length > 0) {
    name = lines[0]; // fallback
  }

  // 4. Links Extraction (GitHub, LinkedIn)
  const links = {
    linkedin: null,
    github: null,
    portfolio: null,
    other: []
  };
  const urlRegex = /https?:\/\/[^\s$.?#].[^\s]*/g;
  const urls = text.match(urlRegex) || [];
  urls.forEach(url => {
    const cleanUrl = url.replace(/[,;.)]$/, ''); // clean trailing punctuation
    if (cleanUrl.includes('linkedin.com')) {
      links.linkedin = cleanUrl;
    } else if (cleanUrl.includes('github.com')) {
      links.github = cleanUrl;
    } else if (cleanUrl.includes('portfolio') || cleanUrl.includes('personal') || cleanUrl.includes('blog')) {
      links.portfolio = cleanUrl;
    } else {
      links.other.push(cleanUrl);
    }
  });

  // Second pass: extract bare domain links without a scheme prefix
  const bareDomainRegex = /\b(?:linkedin\.com\/in\/[^\s|,;]+|github\.com\/[^\s|,;]+)/gi;
  const bareMatches = text.match(bareDomainRegex) || [];
  bareMatches.forEach(match => {
    const cleanMatch = match.replace(/[,;.)]$/, '');
    const fullUrl = cleanMatch.startsWith('http') ? cleanMatch : `https://${cleanMatch}`;
    if (cleanMatch.includes('linkedin.com') && !links.linkedin) links.linkedin = fullUrl;
    if (cleanMatch.includes('github.com') && !links.github) links.github = fullUrl;
  });

  // 5. Skills Extraction
  // Look for skills section or scan for common skills keywords.
  const commonTech = [
    'JavaScript', 'JS', 'TypeScript', 'TS', 'Python', 'Java', 'C\\++', 'C#', 'Ruby', 'PHP', 'Go', 'Golang', 'Rust', 'Swift',
    'HTML', 'CSS', 'Sass', 'Less', 'Tailwind', 'Bootstrap',
    'React', 'Angular', 'Vue', 'Next.js', 'Nuxt.js', 'Express', 'NestJS', 'Koa', 'Django', 'Flask', 'Spring', 'Spring Boot',
    'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Elasticsearch', 'SQL', 'NoSQL',
    'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'GitHub', 'GitLab', 'CI/CD', 'Jenkins', 'Travis',
    'Machine Learning', 'ML', 'Deep Learning', 'NLP', 'Data Science', 'PyTorch', 'TensorFlow'
  ];

  const foundSkills = [];
  commonTech.forEach(tech => {
    // Word boundary regex
    const regex = new RegExp(`\\b${tech}\\b`, 'i');
    if (regex.test(text)) {
      // Normalize name representation (e.g. JS -> JavaScript)
      let canonicalName = tech;
      if (tech.toUpperCase() === 'JS') canonicalName = 'JavaScript';
      if (tech.toUpperCase() === 'TS') canonicalName = 'TypeScript';
      if (tech.toLowerCase() === 'golang') canonicalName = 'Go';
      foundSkills.push(canonicalName);
    }
  });
  const uniqueSkills = [...new Set(foundSkills)];

  // 6. Experience Parse Heuristics (Block-based parsing)
  const experience = [];
  const expIndex = text.toLowerCase().search(/\b(experience|work history|employment|professional history)\b/);
  if (expIndex !== -1) {
    const expText = text.substring(expIndex);
    const expLines = expText.split('\n').map(l => l.trim()).filter(Boolean);
    
    const blocks = [];
    let currentBlock = null;
    
    for (let i = 1; i < Math.min(expLines.length, 60); i++) {
      const line = expLines[i];
      if (/education|skills|projects|interests|certifications|achievements/i.test(line)) {
        break; // reached next section
      }
      
      const dateInfo = extractDateRange(line);
      const isBullet = /^[•\-*◦]/.test(line);
      
      // Starts a new block if it has a date and doesn't start with a bullet point
      if (dateInfo.start && !isBullet) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          header: line,
          dateInfo: dateInfo,
          lines: []
        };
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      }
    }
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    // Process each experience block
    blocks.forEach(block => {
      const start = block.dateInfo.start;
      const end = block.dateInfo.end;
      
      const headerCleaned = block.header
        .replace(block.dateInfo.matchedText || '', '')
        .replace(/\(\s*\)/g, '')
        .replace(/\[\s*\]/g, '')
        .trim()
        .replace(/[-–—,@|]+$/, '')
        .trim();
        
      let title = null;
      let company = null;
      
      // Separator check
      const sepRegex = /\s*([-–—@,|]|\bat\b)\s*/i;
      const parts = headerCleaned.split(sepRegex).filter(p => p && !/[-–—@,|]|\bat\b/i.test(p));
      
      if (parts.length >= 2) {
        title = parts[0].trim();
        company = parts[1].trim();
      } else {
        title = headerCleaned || null;
      }
      
      // If company not found on header line, look at the next line
      let consumedLines = 0;
      if (!company && block.lines.length > 0) {
        const nextLine = block.lines[0];
        const nextLineIsBullet = /^[•\-*◦]/.test(nextLine);
        const nextLineDateInfo = extractDateRange(nextLine);
        
        if (!nextLineIsBullet && !nextLineDateInfo.start) {
          company = nextLine.split(',')[0].trim();
          consumedLines = 1;
        }
      }
      
      // Build summary from remaining block lines
      const summaryLines = block.lines.slice(consumedLines).map(l => {
        return l.replace(/^[•\-*◦]\s*/, '').trim();
      }).filter(Boolean);
      
      const summary = summaryLines.join(' ');
      
      experience.push({
        company: company || null,
        title: title || null,
        start,
        end,
        summary: summary || null
      });
    });
  }

  // 7. Education Parse Heuristics (Block-based parsing)
  const education = [];
  const eduIndex = text.toLowerCase().search(/\b(education|academic history|studies)\b/);
  if (eduIndex !== -1) {
    const eduText = text.substring(eduIndex);
    const eduLines = eduText.split('\n').map(l => l.trim()).filter(Boolean);
    
    const blocks = [];
    let currentBlock = null;
    
    for (let i = 1; i < Math.min(eduLines.length, 30); i++) {
      const line = eduLines[i];
      if (/experience|skills|work history|projects|certifications|achievements/i.test(line)) {
        break; // reached next section
      }
      
      const isSchool = /university|college|school|institute/i.test(line);
      
      if (isSchool) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          header: line,
          lines: []
        };
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      }
    }
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    // Process each education block
    blocks.forEach(block => {
      const dateInfo = extractDateRange(block.header);
      
      const cleanedHeader = block.header
        .replace(dateInfo.matchedText || '', '')
        .replace(/\(\s*\)/g, '')
        .replace(/\[\s*\]/g, '')
        .trim();
        
      const institution = cleanedHeader.split(/,|-|—|–/)[0].trim() || null;
      
      let end_year = null;
      if (dateInfo.end && dateInfo.end !== 'Present') {
        const match = dateInfo.end.match(/^(\d{4})/);
        if (match) end_year = parseInt(match[1], 10);
      } else if (dateInfo.start) {
        const match = dateInfo.start.match(/^(\d{4})/);
        if (match) end_year = parseInt(match[1], 10);
      }
      
      // If end_year not found, check subsequent block lines
      if (!end_year) {
        for (const line of block.lines) {
          const lDateInfo = extractDateRange(line);
          if (lDateInfo.end && lDateInfo.end !== 'Present') {
            const match = lDateInfo.end.match(/^(\d{4})/);
            if (match) {
              end_year = parseInt(match[1], 10);
              break;
            }
          } else if (lDateInfo.start) {
            const match = lDateInfo.start.match(/^(\d{4})/);
            if (match) {
              end_year = parseInt(match[1], 10);
              break;
            }
          }
        }
      }
      
      let degree = null;
      let field = null;
      const searchLines = [block.header, ...block.lines.slice(0, 2)].filter(Boolean);
      
      let degreeLineIdx = -1;
      for (let idx = 0; idx < searchLines.length; idx++) {
        const line = searchLines[idx];
        if (/\bbachelor\b|\bb\.?tech\b|\bb\.?e\.?\b|\bb\.?s\.?\b|\bb\.?a\.?\b/i.test(line)) {
          degree = 'Bachelor';
          degreeLineIdx = idx;
          break;
        } else if (/\bmaster\b|\bm\.?tech\b|\bm\.?s\.?\b|\bm\.?a\.?\b|\bmba\b/i.test(line)) {
          degree = 'Master';
          degreeLineIdx = idx;
          break;
        } else if (/\bph\.?d\.?\b|\bdoctorate\b/i.test(line)) {
          degree = 'PhD';
          degreeLineIdx = idx;
          break;
        } else if (/\bintermediate\b|\bhigh school\b|\bsecondary\b|\b(?:10th|12th)\b|\bdiploma\b/i.test(line)) {
          degree = 'Secondary/Intermediate';
          degreeLineIdx = idx;
          break;
        }
      }
      
      const targetFieldLine = degreeLineIdx !== -1 ? searchLines[degreeLineIdx] : (block.lines[0] || '');
      if (targetFieldLine) {
        // (a) Parentheses match: e.g. Intermediate (Mathematics, Physics, Chemistry)
        const parenMatch = targetFieldLine.match(/\(([^)]+)\)/);
        if (parenMatch && /[A-Za-z]{3,}/.test(parenMatch[1]) && !/\b(?:19|20)\d{2}\b/.test(parenMatch[1])) {
          field = parenMatch[1].trim();
        }

        // (b) "in [Field]" phrasing
        if (!field) {
          const inMatch = targetFieldLine.match(/\bin\s+([A-Za-z][A-Za-z\s&]+?)(?:\s*[;(),]|\s*(?:CGPA|GPA|Score)|\s*\(|$)/i);
          if (inMatch) {
            field = inMatch[1].trim();
          }
        }

        // (c) Comma-separated fallback
        if (!field) {
          const commaMatch = targetFieldLine.match(/,\s*([A-Za-z][A-Za-z\s&]+?)(?:\s*[;(),]|\s*(?:CGPA|GPA|Score)|\s*\(|$)/i);
          if (commaMatch) {
            field = commaMatch[1].trim();
          }
        }
        
        if (field) {
          if (/cgpa|gpa|score|grade|marks|division/i.test(field) || /^\d/.test(field)) {
            field = null;
          }
        }
      }
      
      education.push({
        institution,
        degree,
        field: field || null,
        end_year
      });
    });
  }

  return {
    name,
    emails: uniqueEmails,
    phones: uniquePhones,
    links,
    skills: uniqueSkills,
    experience,
    education
  };
}
