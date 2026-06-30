# Multi-Source Candidate Data Transformer

A full-stack, single-monorepo application for ingesting candidate profiles from multiple structured and unstructured sources, deduplicating them into a single canonical record with complete provenance and confidence scoring, and projecting them into custom output shapes using a runtime configuration.

## Features
- **Deterministic Pipeline**: Pure functions process data from detection through extraction, normalization, merging, confidence calculation, and projection.
- **Deduplication Engine**: Matches candidates based on normalized emails, E.164 phones, or fuzzy name similarity combined with secondary signals.
- **Traceability**: All output fields record the original source and resolution method in a `provenance` log.
- **Dynamic Projection**: Supports runtime configuration schemas using JSON shapes to filter, rename, or normalize output keys.

---

## Tech Stack
- **Backend**: Node.js + Express (JavaScript, ES Modules)
- **Frontend**: React + Vite (JavaScript, HSL dark mode, Glassmorphic UI)
- **Database**: MongoDB via Mongoose
- **Parser Tools**: Papaparse (CSV), PDF-Parse (PDF), Mammoth (DOCX), Libphonenumber-js (Phone), Day.js (Date), Fuse.js (Fuzzy Matching)
- **Validation**: Zod (Canonical profiles and dynamic custom projections)
- **Testing**: Vitest

---

## Scaffolding & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (running locally on port 27017, or a custom URI)

### Installation
1. Install all dependencies for both client and server from the monorepo root:
   ```bash
   npm run install:all
   ```
   *(This runs `npm install` inside both `/server` and `/client` directories automatically).*

2. Alternatively, install them manually:
   ```bash
   # Server
   cd server && npm install
   # Client
   cd ../client && npm install
   ```

3. Set up the backend environment:
   ```bash
   # From the server directory, copy the example env:
   cp .env.example .env
   ```

---

## Run Instructions

### Starting Server and Client Simultaneously (Recommended)
You can run both the Express backend and React frontend with a single command from the monorepo root:
```bash
npm run dev
```
This launches:
- Backend: [http://localhost:5000](http://localhost:5000)
- Frontend: [http://localhost:3000](http://localhost:3000) (with `/api` routing proxy enabled)

### Starting Server and Client Separately (Alternative)
If you prefer separate terminal logs:
1. Start the Express backend:
   ```bash
   cd server
   npm start
   ```
2. Start the React frontend development server:
   ```bash
   cd client
   npm run dev
   ```

---

## CLI Surface
A command-line script is provided to run the transformer over local files.

```bash
# From the server directory:
# Run on sample files using the default config:
npm run cli -- run --sources ../samples/recruiter_sample.csv,../samples/ats_sample.json --out ./output.json

# Run on sample files with a custom projection config:
npm run cli -- run --sources ../samples/recruiter_sample.csv,../samples/ats_sample.json --config ../config.example.json --out ./output_projected.json

# Run on sample files and skip database writes (fast local testing):
npm run cli -- run --sources ../samples --out ./output.json --no-persist
```

---

## Running Automated Tests
Tests are located in `server/tests/` and run using Vitest.

```bash
cd server
npm run test
```

---

## Assumptions

The following design choices and constraints were adopted:
1. **LinkedIn Integration**: Public access to LinkedIn profile data is restricted. When a LinkedIn URL is submitted, the extractor checks for a matching JSON file under the `server/tests/fixtures/` or `samples/` directory. If no fixture matches and a name cannot be derived from the URL slug, the extractor degrades gracefully, returning empty fields with `raw_confidence: 0` (it never invents mock data). When a name can be derived from the URL slug (e.g. `https://linkedin.com/in/bhavana-siva-sri`), it extracts the name as a low-confidence guess (`raw_confidence: 0.3`) with all other fields blank.
2. **Skill Canonicalization**: Standardizing skills utilizes a hand-curated list of ~30 popular developer skills. Fuzzy matching is performed with `fuse.js`. Any unknown skill found on a resume is preserved as-is but assigned a lower default confidence score (`0.4`) to indicate it did not verify against the standard taxonomy.
3. **Source Priority Order**: When scalar fields disagree (e.g. different names on different resumes), conflict resolution prefers the source with the highest raw confidence. In the event of a tie, the system falls back to this source order:
   `ats_json > recruiter_csv > linkedin_json > github_api > resume > recruiter_notes`
4. **Recruiter Notes Confidence**: Text notes (.txt) are treated as freeform, unstructured, and highly subjective. Thus, they are given a low default raw confidence score of `0.3`.
5. **MongoDB / Database Liveness**: The pipeline itself remains database-agnostic. It runs in-memory as pure functions so it can run offline or in `--no-persist` mode without a running MongoDB connection. If a local MongoDB instance is not installed or running, you can connect to a free MongoDB Atlas cluster by setting the `MONGODB_URI` environment variable in `server/.env` to your Atlas connection string.
