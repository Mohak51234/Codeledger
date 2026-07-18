import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
    {
        roomId: { type: String, required: true, unique: true },
        code: { type: String, default: '' },
        version: { type: Number, default: 0 }, // bumped on every accepted write
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lastActiveAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default mongoose.model('Room', roomSchema);