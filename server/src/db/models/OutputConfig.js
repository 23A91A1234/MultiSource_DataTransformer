import mongoose from 'mongoose';

const OutputConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

export const OutputConfig = mongoose.model('OutputConfig', OutputConfigSchema, 'outputconfigs');
export default OutputConfig;
