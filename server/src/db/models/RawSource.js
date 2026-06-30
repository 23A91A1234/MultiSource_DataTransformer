import mongoose from 'mongoose';

const RawSourceSchema = new mongoose.Schema({
  run_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PipelineRun',
    required: true
  },
  source_id: {
    type: String,
    required: true
  },
  source_type: {
    type: String,
    required: true
  },
  candidate_hint: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fields: {
    type: mongoose.Schema.Types.Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  raw_confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

export const RawSource = mongoose.model('RawSource', RawSourceSchema, 'rawsources');
export default RawSource;
