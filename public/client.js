// Get references to the HTML elements
const createButton = document.getElementById('create-button');
const playlistUrlInput = document.getElementById('playlist-url');
const startVideoInput = document.getElementById('start-video');
const endVideoInput = document.getElementById('end-video');
const statusOutput = document.getElementById('status-output');

// Add a click event listener to the button
createButton.addEventListener('click', async () => {
    // Get values from the input fields
    const playlistUrl = playlistUrlInput.value;
    const startNum = parseInt(startVideoInput.value, 10);
    const endNum = parseInt(endVideoInput.value, 10);

    // Basic validation
    if (!playlistUrl || startNum < 1 || endNum < startNum) {
        log('Error: Please provide a valid URL and range.');
        return;
    }

    // Disable the button and show a processing message
    createButton.disabled = true;
    log('Processing... This may take a moment.');

    try {
        // Use the fetch API to send a POST request to our server's endpoint
        const response = await fetch('/split-playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playlistUrl,
                startNum,
                endNum
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            // If the server returned an error, log it
            throw new Error(result.message);
        }

        // Log the success message and the link to the new playlist
        log(`✅ Success! <a href="${result.url}" target="_blank">View your new playlist here.</a>`);

    } catch (error) {
        // Log any errors that occurred during the process
        log(`❌ Error: ${error.message}`);
    } finally {
        // Re-enable the button once the process is complete
        createButton.disabled = false;
    }
});

// Helper function to log messages to the status box
function log(message) {
    statusOutput.innerHTML = message;
}