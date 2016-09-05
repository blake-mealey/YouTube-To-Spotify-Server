var express = require('express');
	router = express.Router();
var request = require('request');
var querystring = require('querystring');
var redis = require('redis');
	client = redis.createClient();
var fs = require('fs');

var spotifyAppInfo = JSON.parse(fs.readFileSync("spotify_app.json", "utf8"));

client.on("error", (err) => {
	console.log("Error " + err);
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
function generateRandomString(length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for(var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

var cookieKeys = {
	state: 'spotify_auth_state',
	clientQuery: 'initial_client_query'
};

/* GET home page. */
router.get('/', (req, res, next) => {
	res.render('login', { title: 'Login to Spotify' });
});

router.get('/content', (req, res, next) => {
	res.render('content', { title: 'App Stuff' });
});

router.get('/authenticate', (req, res, next) => {
	var state = generateRandomString(16);
	res.cookie(cookieKeys.state, state);
	res.cookie(cookieKeys.clientQuery, req.query);

	var scope = 'playlist-modify-public';
	res.redirect('https://accounts.spotify.com/authorize?' + 
		querystring.stringify({
			response_type: 'code',
			client_id: spotifyAppInfo.client_id,
			scope: scope,
			redirect_uri: spotifyAppInfo.redirect_uri,
			state: state,
			show_dialog: true
		}));
});

router.get('/auth-callback', (req, res, next) => {
	var code = req.query.code || null;
	var state = req.query.state || null;
	var storedState = req.cookies ? req.cookies[cookieKeys.state] : null;

	if(state === null || state !== storedState) {
		console.log("FAIL 1");
		console.log(req.query.error);
	} else {
		console.log(code);

		res.clearCookie(cookieKeys.state);
		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: spotifyAppInfo.redirect_uri,
				grant_type: 'authorization_code'
			},
			headers: {
				'Authorization': 'Basic ' + (new Buffer(client_id + ':' + spotifyAppInfo.client_secret).toString('base64'))
			},
			json: true
		};

		request.post(authOptions, (error, response, body) => {
			if(!error && response.statusCode == 200) {
				var access_token = body.access_token;
				var refresh_token = body.refresh_token;

				if(req.cookies) {
					var clientQuery = req.cookies[cookieKeys.clientQuery];

					var options = {
						url: 'https://api.spotify.com/v1/me',
						headers: { 'Authorization': 'Bearer ' + access_token },
						json: true
					};

					request.get(options, (error, response, body) => {
						client.hmset(clientQuery.clientId, {
							"spotifyId": body.id,
							"accessToken": access_token,
							"refreshToken": refresh_token,
						}, (err, reply) => {
							if(clientQuery.saveTrack) {
								saveTrack(clientQuery.clientId, clientQuery.trackUri, (error, response) => {
									console.log(error);
								});
							}
						});
					});
				}

				res.redirect('/content');
			} else {
				console.log(error);
				console.log(response.statusCode);
				console.log("FAIL 2");
				console.log("invalid_token");
			}
		});
	}
});

router.post('/saveTrack', (req, res, next) => {
	var clientId = req.query.clientId;

	client.hgetall(clientId, (err, userData) => {
		if(userData.spotifyId === req.query.spotifyId) {
			saveTrack(clientId, req.query.trackUri, (error, response) => {
				var ok = error !== null;
				res.send({
					ok: ok,
					error: (ok ? error : undefined)
				});
			});
		} else {
			res.send({
				ok: false,
				error: 'incorrect_spotify_id'
			});
		}
	});
});

router.get('/userInfo', (req, res, next) => {
	console.log("HELLO");
	client.hgetall(req.query.clientId, (err, reply) => {
		var authenticated = reply !== null;
		res.send({
			userAuthenticated: authenticated,
			spotifyId: (authenticated ? reply.spotifyId : undefined)
		});
	});
});

function saveTrack(clientId, trackUri, callback) {
	client.hgetall(clientId, (err, userData) => {
		if(userData.playlistId) {
			saveTrackToPlaylist(clientId, userData.playlistId, trackUri, callback);
		} else {
			var options = {
				url: 'https://api.spotify.com/v1/users/' + userData.spotifyId + '/playlists',
				headers: { 'Authorization': 'Bearer ' + userData.accessToken },
				body: {
					name: "From YouTube",
					public: true
				},
				json: true
			};

			request.post(options, (error, response, body) => {
				userData.playlistId = body.id;
				console.log(body);
				client.hset(clientId,
					"playlistId", body.id,
					(err, res) => {
						saveTrackToPlaylist(clientId, body.id, trackUri, callback);
					});
			});
		}
	});
}

function saveTrackToPlaylist(clientId, playlistId, trackUri, callback) {
	client.hgetall(clientId, (err, userData) => {
		var options = {
			url: 'https://api.spotify.com/v1/users/' + userData.spotifyId + '/playlists/' + playlistId + '/tracks',
			headers: { 'Authorization': 'Bearer ' + userData.accessToken },
			body: {
				uris: [ trackUri ]
			},
			json: true
		};

		request.post(options, (error, response, body) => {
			callback(error, response);
		});
	});
}

module.exports = router;
