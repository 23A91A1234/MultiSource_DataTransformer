import mongoose from 'mongoose';

const CandidateProfileSchema = new mongoose.Schema({
  run_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PipelineRun',
    required: true
  },
  candidate_id: {
    type: String,
    required: true
  },
  profile: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Unique compound index on { run_id, candidate_id }
CandidateProfileSchema.index({ run_id: 1, candidate_id: 1 }, { unique: true });

export const CandidateProfile = mongoose.model('CandidateProfile', CandidateProfileSchema, 'candidateprofiles');
export default CandidateProfile;
