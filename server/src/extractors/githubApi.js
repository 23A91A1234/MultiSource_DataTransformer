/**
 * Extracts data from GitHub API.
 * Requests:
 * - https://api.github.com/users/{username}
 * - https://api.github.com/users/{username}/repos
 * @param {string} content - GitHub URL or username
 * @param {string} [filename]
 * @returns {Promise<object>} RawRecord
 */
export async function extract(content, filename = 'github_api') {
  let username = content.trim();
  
  // Extract username if URL is provided
  if (username.includes('github.com')) {
    try {
      const urlObj = new URL(username.startsWith('http') ? username : `https://${username}`);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        username = pathParts[0];
      }
    } catch (e) {
      console.warn('Could not parse GitHub URL, using raw string:', username);
    }
  }

  if (!username) {
    return {
      source_id: filename,
      source_type: 'unstructured',
      candidate_hint: { name: null, email: null, phone: null },
      fields: {},
      raw_confidence: 0
    };
  }

  try {
    const headers = {
      'User-Agent': 'Antigravity-Candidate-Transformer-App'
    };

    const profileRes = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!profileRes.ok) {
      throw new Error(`GitHub Profile API returned status ${profileRes.status}`);
    }
    const profile = await profileRes.json();

    let languages = [];
    try {
      const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });
      if (reposRes.ok) {
        const repos = await reposRes.json();
        const langMap = {};
        if (Array.isArray(repos)) {
          repos.forEach(repo => {
            if (repo.language) {
              langMap[repo.language] = (langMap[repo.language] || 0) + 1;
            }
          });
        }
        // Sort languages by repo count descending
        languages = Object.keys(langMap).sort((a, b) => langMap[b] - langMap[a]);
      }
    } catch (repoError) {
      console.warn('Failed to fetch repositories for GitHub user:', username, repoError.message);
    }

    const fields = {
      name: profile.name || null,
      email: profile.email || null,
      bio: profile.bio || null,
      github: profile.html_url || `https://github.com/${username}`,
      portfolio: profile.blog || null,
      languages: languages,
      public_repos: profile.public_repos || 0
    };

    return {
      source_id: `github:${username}`,
      source_type: 'unstructured',
      candidate_hint: {
        name: fields.name,
        email: fields.email,
        phone: null
      },
      fields,
      raw_confidence: 0.8
    };
  } catch (error) {
    console.warn(`Failed to extract from GitHub API for user ${username}:`, error.message);
    return {
      source_id: `github:${username}`,
      source_type: 'unstructured',
      candidate_hint: { name: null, email: null, phone: null },
      fields: {},
      raw_confidence: 0
    };
  }
}

export default { extract };
