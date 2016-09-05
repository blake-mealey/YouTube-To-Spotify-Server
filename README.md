# Authentication server for YouTube to Spotify Chrome Extension

This is a Node.js server which exists to perform Spotify authenticated web API calls for a chrome extension which is inherintly client-side and open source. The YouTube-to-Spotify project can be found on GitHub [here](https://github.com/blake-mealey/YouTube-To-Spotify).

## Setup

Add a `spotify_app.json` file which looks like the following:

	{
		"client_id": "12345",
		"client_secret": "12345",
		"redirect_uri": "http://hostname/auth-callback"
	}

Where each value is populated based on a Spotify App you have to create. Make sure your authentication callback uses the `/auth-callback` endpoint or the server will not properly handle it.

You will also need a redis server running on your system. The default server configuration should work.

Finally, run `npm install && npm start` and the server should launch and be visible at `localhost:3000` with a simple login page which will attempt to authenticate a user with Spotify.
