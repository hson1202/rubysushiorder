import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true
    },
    description: { 
        type: String, 
        default: "" 
    },
    image: { 
        type: String, 
        default: "" 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    sortOrder: { 
        type: Number, 
        default: 0 
    },
    language: { 
        type: String, 
        enum: ['vi', 'en', 'hu'], 
        default: 'vi',
        required: true 
    }
}, {
    timestamps: true
});

// Ensure uniqueness per language, not globally by name
categorySchema.index({ name: 1, language: 1 }, { unique: true });

const categoryModel = mongoose.models.category || mongoose.model("category", categorySchema);

export default categoryModel; 