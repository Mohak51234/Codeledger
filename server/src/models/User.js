import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true }
);

userSchema.methods.verifyPassword = function (plain) {
    return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
    return bcrypt.hash(plain, 10);
};

export default mongoose.model('User', userSchema);