import mongoose from 'mongoose';

const PipelineRunSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['completed', 'failed', 'partial'],
    required: true
  },
  source_count: {
    type: Number,
    default: 0
  },
  profile_count: {
    type: Number,
    default: 0
  },
  config_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OutputConfig',
    default: null
  },
  warnings: {
    type: [String],
    default: []
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  finished_at: {
    type: Date
  }
});

export const PipelineRun = mongoose.model('PipelineRun', PipelineRunSchema, 'pipelineruns');
export default PipelineRun;
