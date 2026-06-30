/**
 * Extracts data from ATS JSON.
 * Contains an explicit field mapping table.
 * 
 * Field Mapping Table:
 * | ATS JSON Key           | Target Field             | Description                      |
 * |------------------------|--------------------------|----------------------------------|
 * | cand_full_name         | name                     | Candidate's full name            |
 * | email_addr             | email                    | Primary email address            |
 * | phone_num              | phone                    | Phone number                     |
 * | company_name           | current_company          | Current employing company        |
 * | position               | title                    | Current job title                |
 * | years_of_experience    | years_experience         | Numeric years of experience      |
 * | linkedin_url           | linkedin                 | LinkedIn URL                     |
 * | github_url             | github                   | GitHub profile URL               |
 * | jobs                   | experience               | Array of experience objects      |
 * | -- jobs[i].firm        | experience[i].company    | Company name                     |
 * | -- jobs[i].role        | experience[i].title      | Job title                        |
 * | -- jobs[i].from        | experience[i].start      | Start date YYYY-MM               |
 * | -- jobs[i].to          | experience[i].end        | End date YYYY-MM                 |
 * | -- jobs[i].desc        | experience[i].summary    | Job description                  |
 * | schools                | education                | Array of education objects       |
 * | -- schools[i].univ     | education[i].institution | Institution                      |
 * | -- schools[i].dip      | education[i].degree      | Degree                           |
 * | -- schools[i].major    | education[i].field       | Major/Field                      |
 * | -- schools[i].grad_yr  | education[i].end_year    | Graduation year                  |
 */
export async function extract(content, filename = 'ats_json') {
  try {
    const json = typeof content === 'string' ? JSON.parse(content) : JSON.parse(content.toString('utf-8'));
    
    // Map the raw ATS fields into mapped fields for normalization
    const fields = {
      name: json.cand_full_name || null,
      email: json.email_addr || null,
      phone: json.phone_num || null,
      current_company: json.company_name || null,
      title: json.position || null,
      years_experience: typeof json.years_of_experience === 'number' ? json.years_of_experience : null,
      linkedin: json.linkedin_url || null,
      github: json.github_url || null,
      experience: Array.isArray(json.jobs) ? json.jobs.map(job => ({
        company: job.firm || null,
        title: job.role || null,
        start: job.from || null,
        end: job.to || null,
        summary: job.desc || null
      })) : [],
      education: Array.isArray(json.schools) ? json.schools.map(school => ({
        institution: school.univ || null,
        degree: school.dip || null,
        field: school.major || null,
        end_year: typeof school.grad_yr === 'number' ? school.grad_yr : null
      })) : []
    };

    return {
      source_id: filename,
      source_type: 'structured',
      candidate_hint: {
        name: fields.name,
        email: fields.email,
        phone: fields.phone
      },
      fields,
      raw_confidence: 0.95
    };
  } catch (error) {
    console.warn(`Failed to parse ATS JSON from ${filename}:`, error);
    return {
      source_id: filename,
      source_type: 'structured',
      candidate_hint: { name: null, email: null, phone: null },
      fields: {},
      raw_confidence: 0
    };
  }
}

export default { extract };
