# Markov Image Generator

This project is a web-based application that generates unique pixel art images using a Markov chain model. Users can upload their own images to train the model, and then generate new images based on the learned patterns.

## Demo

Test this application online [here](https://morra.co/markov-image-generator/).

## Features

- **Image Upload:** Upload multiple images to be used as a basis for training the Markov chain model.
- **Color Quantization:** Reduce the color palette of the source images to a specified number of colors using K-means clustering.
- **Markov Chain Learning:** The application builds a Markov chain model from the uploaded images, learning the probabilistic transitions between adjacent pixel colors.
- **Image Generation:** Generate new images of a specified width and height based on the learned Markov chain model.
- **Download Image:** Download the generated image as a PNG file.

## How It Works

The process of generating a new image can be broken down into the following steps:

1.  **Image Preprocessing:**
    *   The user uploads one or more base images.
    *   The application resizes the images to a uniform dimension.
    *   The colors of the images are quantized to a smaller, representative palette using a K-means clustering algorithm. This simplifies the color space and helps to create a more coherent final image.

2.  **Markov Chain Model Training:**
    *   The application iterates through each pixel of the preprocessed source images.
    *   It builds a transition matrix (the Markov chain) that records the probability of one color appearing next to another, both horizontally and vertically.

3.  **Image Generation:**
    *   A new image is started with a random color from the learned palette.
    *   Each subsequent pixel is chosen based on the color of its left and top neighbors, using the probabilities stored in the Markov chain.
    *   If a pixel has no learned transitions (e.g., at the edges), a random color is chosen from the palette.

## Technologies Used

-   **HTML5:** For the structure of the web page.
-   **Tailwind CSS:** For styling the user interface.
-   **JavaScript (ES6+):** For all the application logic, including the image processing, Markov chain implementation, and user interaction.

## How to Use

1.  **Upload Images:** Click the "Upload Base Images" button and select one or more images from your computer.
2.  **Set Parameters:**
    *   **Target Color Count:** Choose the number of colors you want in the final image's palette.
    *   **Target Width & Height:** Set the dimensions of the generated image.
3.  **Process Images & Learn:** Click the "Process Images & Learn" button to start the training process.
4.  **Generate New Image:** Once the model is trained, click the "Generate New Image" button to create a new image.
5.  **Download Image:** Click the "Download Image" button to save the generated image to your computer.

## File Structure

-   `index.html`: The main HTML file that defines the structure of the web application.
-   `script.js`: Contains all the JavaScript code for the application, including the UI logic, image processing, and Markov chain implementation.
-   `styles.css`: The main stylesheet for the application.
-   `README.md`: This file.

## Future Improvements

-   Implement different transition models (e.g., considering diagonal neighbors).
-   Allow users to save and load their trained Markov chain models.
-   Add more sophisticated color quantization algorithms.
-   Improve the user interface and provide more feedback during the training process.