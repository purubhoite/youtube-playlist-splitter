// Import necessary packages
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();
const rateLimit = require('express-rate-limit');


// Initialize the express app
const app = express();
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.static('public')); // Serve static files from the 'public' directory
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window (every 15 mins)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

const PORT = process.env.PORT || 3000;

// --- YouTube API Authentication ---
// This function uses the Service Account key to authorize
const authenticate = () => {
    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://developers.google.com/oauthplayground' // Redirect URI
    );

    oAuth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    return google.youtube({ version: 'v3', auth: oAuth2Client });
};
const youtube = authenticate();

// --- Helper Functions ---
const getPlaylistIdFromUrl = (url) => {
    const regex = /[?&]list=([^&]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

// Fetches all items from a playlist, handling pagination
const getAllPlaylistItems = async (playlistId) => {
    let items = [];
    let nextPageToken = '';
    do {
        const res = await youtube.playlistItems.list({
            part: 'snippet',
            playlistId: playlistId,
            maxResults: 50,
            pageToken: nextPageToken,
        });
        items = items.concat(res.data.items);
        nextPageToken = res.data.nextPageToken;
    } while (nextPageToken);
    return items;
};

// Gets the title of the original playlist
const getPlaylistInfo = async (playlistId) => {
    const res = await youtube.playlists.list({
        part: 'snippet',
        id: playlistId,
    });
    return res.data.items[0].snippet;
};

// Creates a new playlist on your dedicated channel
const createNewPlaylist = async (title, description) => {
    const res = await youtube.playlists.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: {
                title: title,
                description: description,
                // The channelId of YOUR dedicated channel where playlists will be created
                
            },
            status: {
                privacyStatus: 'public', // Or 'private' or 'unlisted'
            },
        },
    });
    return res.data;
};

// Adds an array of videos to a specified playlist
const addVideosToPlaylist = async (newPlaylistId, videos) => {
    for (const video of videos) {
        await youtube.playlistItems.insert({
            part: 'snippet',
            requestBody: {
                snippet: {
                    playlistId: newPlaylistId,
                    resourceId: {
                        kind: 'youtube#video',
                        videoId: video.snippet.resourceId.videoId,
                    },
                },
            },
        });
    }
};

// --- Main API Endpoint ---
app.post('/split-playlist', limiter, async (req, res) =>  {
    try {
        const { playlistUrl, startNum, endNum } = req.body;
        const sourcePlaylistId = getPlaylistIdFromUrl(playlistUrl);

        if (!sourcePlaylistId) {
            return res.status(400).json({ message: 'Invalid YouTube Playlist URL.' });
        }

        // 1. Fetch all video items
        const allItems = await getAllPlaylistItems(sourcePlaylistId);
        
        // 2. Get original playlist info for the title
        const sourceInfo = await getPlaylistInfo(sourcePlaylistId);
        
        // 3. Slice the array to get the desired videos
        const itemsToSplit = allItems.slice(startNum - 1, endNum);
        if (itemsToSplit.length === 0) {
            return res.status(400).json({ message: 'The selected range contains no videos.' });
        }

        // 4. Create the new playlist
        const newPlaylistTitle = `${sourceInfo.title} (Split ${startNum}-${endNum})`;
        const newPlaylistDescription = `A split playlist from "${sourceInfo.title}". Created by the Playlist Splitter Tool.`;
        const newPlaylist = await createNewPlaylist(newPlaylistTitle, newPlaylistDescription);

        // 5. Add videos to the new playlist
        await addVideosToPlaylist(newPlaylist.id, itemsToSplit);

        // 6. Send success response with the new playlist URL
        const newPlaylistUrl = `https://www.youtube.com/playlist?list=${newPlaylist.id}`;
        res.json({ message: 'Success!', url: newPlaylistUrl });

    } catch (error) {
        console.error('API Error:', error.response ? error.response.data.error : error.message);
        res.status(500).json({ message: 'An error occurred on the server.' });
    }
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});