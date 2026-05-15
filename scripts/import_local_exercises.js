const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_DIR = 'C:/Users/alexd/OneDrive/Bureau/Projet/exercises.json/exercises';
const TARGET_IMAGES_DIR = path.join(__dirname, '../assets/exercise_images');
const TARGET_DATA_FILE = path.join(__dirname, '../assets/data/generatedExercises.ts');

// Ensure target directories exist
if (!fs.existsSync(TARGET_IMAGES_DIR)) {
    fs.mkdirSync(TARGET_IMAGES_DIR, { recursive: true });
}

const exercises = [];
const directories = fs.readdirSync(SOURCE_DIR);

console.log(`Found ${directories.length} exercises. Processing...`);

directories.forEach(dirName => {
    const dirPath = path.join(SOURCE_DIR, dirName);
    const jsonPath = path.join(dirPath, 'exercise.json');

    if (fs.statSync(dirPath).isDirectory() && fs.existsSync(jsonPath)) {
        try {
            const exerciseData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            
            // Handle Images
            let imageImport = 'null';
            const imagesDir = path.join(dirPath, 'images');
            
            if (fs.existsSync(imagesDir) && fs.statSync(imagesDir).isDirectory()) {
                const imageFiles = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
                
                if (imageFiles.length > 0) {
                    const originalImageName = imageFiles[0]; // Take the first one found
                    const sourceImagePath = path.join(imagesDir, originalImageName);
                    
                    // We rename it to match the ID to avoid collisions: "3_4_Sit-Up.jpg"
                    const ext = path.extname(originalImageName);
                    const targetImageName = `${dirName}${ext}`;
                    const targetImagePath = path.join(TARGET_IMAGES_DIR, targetImageName);

                    try {
                        fs.copyFileSync(sourceImagePath, targetImagePath);
                        imageImport = `require('@/assets/exercise_images/${targetImageName}')`;
                    } catch (copyErr) {
                         console.error(`Failed to copy image for ${dirName}:`, copyErr.message);
                    }
                }
            }

            // Map to our schema
            exercises.push({
                id: dirName,
                name: exerciseData.name,
                muscle: capitalize(exerciseData.primaryMuscles[0] || 'Body'),
                equipment: capitalize(exerciseData.equipment || 'Body'),
                imageImport: imageImport, // Special field for code generation
                description: exerciseData.instructions[0] || '',
                instructions: (exerciseData.instructions || []).join('\n')
            });

        } catch (e) {
            console.error(`Error processing ${dirName}:`, e.message);
        }
    }
});

// Generate TypeScript Content
const fileContent = `
export const initialExercises = [
${exercises.map(ex => `  {
    id: "${ex.id}",
    name: "${escapeString(ex.name)}",
    muscle: "${escapeString(ex.muscle)}",
    equipment: "${escapeString(ex.equipment)}",
    image: ${ex.imageImport},
    description: "${escapeString(ex.description)}",
    instructions: "${escapeString(ex.instructions)}"
  }`).join(',\n')}
];
`;

fs.writeFileSync(TARGET_DATA_FILE, fileContent);
console.log(`Successfully generated ${exercises.length} exercises in ${TARGET_DATA_FILE}`);

// Helpers
function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeString(s) {
    if (!s) return '';
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
