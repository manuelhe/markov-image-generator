(async function() {
    // --- UI Element References ---
    const imageFilesInput = document.getElementById('imageFiles');
    const targetWidthInput = document.getElementById('targetWidth');
    const targetHeightInput = document.getElementById('targetHeight');
    const colorCountInput = document.getElementById('colorCount');
    const processBtn = document.getElementById('processBtn');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusLog = document.getElementById('statusLog');
    const canvas = document.getElementById('generatedImageCanvas');
    const ctx = canvas.getContext('2d');

    // --- Global State ---
    let baseImagesData = [];
    let markovChainModel = {};
    let colorPalette = [];

    // --- Helper Functions ---
    /**
     * Updates the status log with a message.
     * @param {string} message The message to display.
     */
    function updateStatus(message) {
        statusLog.textContent = message;
    }

    /**
     * Converts an RGB color object to a string key.
     * @param {{r: number, g: number, b: number}} color
     * @returns {string} The color key in "r,g,b" format.
     */
    function toColorKey(color) {
        return `${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)}`;
    }

    /**
     * Converts a color key string back to an RGB object.
     * @param {string} key The color key string.
     * @returns {{r: number, g: number, b: number}} The RGB color object.
     */
    function fromColorKey(key) {
        const [r, g, b] = key.split(',').map(Number);
        return {r, g, b};
    }

    /**
     * Calculates the squared Euclidean distance between two colors.
     * @param {{r: number, g: number, b: number}} color1
     * @param {{r: number, g: number, b: number}} color2
     * @returns {number} The squared distance.
     */
    function colorDistanceSquared(color1, color2) {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return dr * dr + dg * dg + db * db;
    }

    /**
     * Finds the closest color in a given palette to a target color.
     * @param {{r: number, g: number, b: number}} targetColor
     * @param {Array<{r: number, g: number, b: number}>} palette
     * @returns {{r: number, g: number, b: number}} The closest color from the palette.
     */
    function findClosestColor(targetColor, palette) {
        let minDistance = Infinity;
        let closestColor = palette[0];
        for (const pColor of palette) {
            const distance = colorDistanceSquared(targetColor, pColor);
            if (distance < minDistance) {
                minDistance = distance;
                closestColor = pColor;
            }
        }
        return closestColor;
    }

    // --- Main Application Logic ---

    /**
     * Performs K-means clustering for color reduction (quantization).
     * @param {ImageData} imageData The source image data.
     * @param {number} k The target number of colors.
     * @returns {Array<{r: number, g: number, b: number}>} The final color palette.
     */
    function kmeans(imageData, k) {
        const pixels = [];
        for (let i = 0; i < imageData.data.length; i += 4) {
            pixels.push({
                r: imageData.data[i],
                g: imageData.data[i + 1],
                b: imageData.data[i + 2]
            });
        }

        if (pixels.length < k) {
            return pixels.filter((p, i, self) => i === self.findIndex(t => toColorKey(t) === toColorKey(p)));
        }

        // Initialize centroids randomly
        let centroids = [];
        for (let i = 0; i < k; i++) {
            centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
        }

        let iterations = 0;
        let changed = true;
        const maxIterations = 20;

        while (changed && iterations < maxIterations) {
            changed = false;
            const clusters = Array.from({ length: k }, () => []);

            // Assign pixels to the closest centroid
            for (const pixel of pixels) {
                let minDistance = Infinity;
                let closestIndex = 0;
                for (let i = 0; i < k; i++) {
                    const distance = colorDistanceSquared(pixel, centroids[i]);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = i;
                    }
                }
                clusters[closestIndex].push(pixel);
            }

            // Recalculate centroids
            for (let i = 0; i < k; i++) {
                if (clusters[i].length > 0) {
                    const newCentroid = clusters[i].reduce((acc, p) => ({
                        r: acc.r + p.r,
                        g: acc.g + p.g,
                        b: acc.b + p.b
                    }), {r: 0, g: 0, b: 0});
                    newCentroid.r /= clusters[i].length;
                    newCentroid.g /= clusters[i].length;
                    newCentroid.b /= clusters[i].length;

                    if (colorDistanceSquared(newCentroid, centroids[i]) > 1) {
                        changed = true;
                    }
                    centroids[i] = newCentroid;
                }
            }
            iterations++;
        }
        return centroids;
    }

    /**
     * Handles the image processing and Markov chain learning.
     * @param {Array<File|string>} sources - An array of image sources (File objects or data URLs).
     */
    async function processImages(sources) {
        if (sources.length === 0) {
            updateStatus('Please select or generate at least one image.');
            return;
        }

        const targetWidth = parseInt(targetWidthInput.value);
        const targetHeight = parseInt(targetHeightInput.value);
        const colorCount = parseInt(colorCountInput.value);

        if (isNaN(targetWidth) || isNaN(targetHeight) || isNaN(colorCount) || targetWidth <= 0 || targetHeight <= 0 || colorCount <= 0) {
            updateStatus('Please enter valid positive numbers for all parameters.');
            return;
        }
        
        // Clear previous data
        baseImagesData = [];
        markovChainModel = {};
        colorPalette = [];

        processBtn.disabled = true;
        generateBtn.disabled = true;
        downloadBtn.disabled = true;
        updateStatus('Starting image processing...');

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;

        const allPixels = [];

        for (let i = 0; i < sources.length; i++) {
            updateStatus(`Processing image ${i + 1} of ${sources.length}...`);
            const source = sources[i];

            await new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    tempCtx.clearRect(0, 0, targetWidth, targetHeight);
                    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
                    
                    const imageData = tempCtx.getImageData(0, 0, targetWidth, targetHeight);
                    
                    for (let j = 0; j < imageData.data.length; j += 4) {
                        allPixels.push({
                            r: imageData.data[j],
                            g: imageData.data[j + 1],
                            b: imageData.data[j + 2]
                        });
                    }
                    
                    baseImagesData.push(imageData);
                    resolve();
                };
                if (typeof source === 'string') {
                    img.src = source;
                } else {
                    const reader = new FileReader();
                    reader.onload = e => { img.src = e.target.result; };
                    reader.readAsDataURL(source);
                }
            });
        }
        
        updateStatus('Images subscaled. Quantizing colors...');
        
        colorPalette = kmeans({ data: new Uint8ClampedArray(allPixels.flatMap(p => [p.r, p.g, p.b, 255])) }, colorCount);
        
        updateStatus('Color quantization complete. Learning Markov chain...');
        
        learnMarkovChain(baseImagesData, colorPalette);
        
        updateStatus(`Markov chain learning complete. Model has ${Object.keys(markovChainModel).length} unique colors. You can now generate an image.`);
        processBtn.disabled = false;
        generateBtn.disabled = false;
    }

    /**
     * Builds the Markov chain model from the preprocessed images.
     * @param {Array<ImageData>} imageDataArray The array of subscaled image data.
     * @param {Array<{r: number, g: number, b: number}>} palette The quantized color palette.
     */
    function learnMarkovChain(imageDataArray, palette) {
        markovChainModel = {};
        if (imageDataArray.length === 0) return;
        const width = imageDataArray[0].width;
        const height = imageDataArray[0].height;

        for (const imageData of imageDataArray) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const currentColor = {
                        r: imageData.data[idx],
                        g: imageData.data[idx + 1],
                        b: imageData.data[idx + 2]
                    };
                    const quantizedColor = findClosestColor(currentColor, palette);
                    const currentKey = toColorKey(quantizedColor);

                    if (!markovChainModel[currentKey]) {
                        markovChainModel[currentKey] = {};
                    }

                    if (x + 1 < width) {
                        const rightIdx = (y * width + (x + 1)) * 4;
                        const rightColor = { r: imageData.data[rightIdx], g: imageData.data[rightIdx + 1], b: imageData.data[rightIdx + 2] };
                        const quantizedRight = findClosestColor(rightColor, palette);
                        const rightKey = toColorKey(quantizedRight);
                        markovChainModel[currentKey][rightKey] = (markovChainModel[currentKey][rightKey] || 0) + 1;
                    }

                    if (y + 1 < height) {
                        const bottomIdx = ((y + 1) * width + x) * 4;
                        const bottomColor = { r: imageData.data[bottomIdx], g: imageData.data[bottomIdx + 1], b: imageData.data[bottomIdx + 2] };
                        const quantizedBottom = findClosestColor(bottomColor, palette);
                        const bottomKey = toColorKey(quantizedBottom);
                        markovChainModel[currentKey][bottomKey] = (markovChainModel[currentKey][bottomKey] || 0) + 1;
                    }
                }
            }
        }

        for (const currentKey in markovChainModel) {
            const transitions = markovChainModel[currentKey];
            const totalTransitions = Object.values(transitions).reduce((sum, count) => sum + count, 0);
            if (totalTransitions > 0) {
                for (const nextKey in transitions) {
                    transitions[nextKey] /= totalTransitions;
                }
            }
        }
    }

    /**
     * Generates a new image using the learned Markov chain model.
     */
    function generateImage() {
        if (Object.keys(markovChainModel).length === 0) {
            updateStatus('Please process images and learn the model first.');
            return;
        }
        
        const targetWidth = parseInt(targetWidthInput.value);
        const targetHeight = parseInt(targetHeightInput.value);

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const imageData = ctx.createImageData(targetWidth, targetHeight);

        updateStatus('Generating new image...');
        generateBtn.disabled = true;
        processBtn.disabled = true;
        downloadBtn.disabled = true;

        const paletteKeys = Object.keys(markovChainModel);
        let startColorKey = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
        const startColor = fromColorKey(startColorKey);
        
        imageData.data[0] = startColor.r;
        imageData.data[1] = startColor.g;
        imageData.data[2] = startColor.b;
        imageData.data[3] = 255;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                if (x === 0 && y === 0) continue;

                const possibleNextColors = {};

                if (x > 0) {
                    const leftIdx = (y * targetWidth + (x - 1)) * 4;
                    const leftColor = { r: imageData.data[leftIdx], g: imageData.data[leftIdx + 1], b: imageData.data[leftIdx + 2] };
                    const leftKey = toColorKey(leftColor);
                    const transitions = markovChainModel[leftKey];
                    if (transitions) {
                        for (const nextKey in transitions) {
                            possibleNextColors[nextKey] = (possibleNextColors[nextKey] || 0) + transitions[nextKey];
                        }
                    }
                }

                if (y > 0) {
                    const aboveIdx = ((y - 1) * targetWidth + x) * 4;
                    const aboveColor = { r: imageData.data[aboveIdx], g: imageData.data[aboveIdx + 1], b: imageData.data[aboveIdx + 2] };
                    const aboveKey = toColorKey(aboveColor);
                    const transitions = markovChainModel[aboveKey];
                    if (transitions) {
                        for (const nextKey in transitions) {
                            possibleNextColors[nextKey] = (possibleNextColors[nextKey] || 0) + transitions[nextKey];
                        }
                    }
                }

                if (Object.keys(possibleNextColors).length === 0) {
                    const randomKey = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
                    possibleNextColors[randomKey] = 1;
                }

                const totalProb = Object.values(possibleNextColors).reduce((sum, prob) => sum + prob, 0);
                const randomVal = Math.random() * totalProb;
                let cumulativeProb = 0;
                let chosenKey;

                for (const key in possibleNextColors) {
                    cumulativeProb += possibleNextColors[key];
                    if (randomVal <= cumulativeProb) {
                        chosenKey = key;
                        break;
                    }
                }
                
                const chosenColor = fromColorKey(chosenKey);
                const idx = (y * targetWidth + x) * 4;
                imageData.data[idx] = chosenColor.r;
                imageData.data[idx + 1] = chosenColor.g;
                imageData.data[idx + 2] = chosenColor.b;
                imageData.data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        updateStatus('Image generation complete!');
        generateBtn.disabled = false;
        processBtn.disabled = false;
        downloadBtn.disabled = false;
    }

    /**
     * Downloads the currently displayed canvas image.
     */
    function downloadImage() {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'markov-generated-image.png';
        link.click();
    }


    // --- Event Listeners ---
    processBtn.addEventListener('click', () => processImages(Array.from(imageFilesInput.files)));
    generateBtn.addEventListener('click', generateImage);
    downloadBtn.addEventListener('click', downloadImage);

})();
