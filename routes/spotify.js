var express = require("express");
var router = express.Router();
var SpotifyWebApi = require("spotify-web-api-node");
var shortid = require("shortid");
var superagent = require("superagent");
var _ = require("lodash");
var dotenv = require("dotenv");

let parsed = {};

if ((process.env.NODE_ENV || "dev") === "dev") {
  const data = dotenv.config();
  parsed = data.parsed;
} else {
  parsed = process.env;
}

const clientId = parsed.CLIENT_ID;
const clientSecret = parsed.CLIENT_SECRET;
const uri = parsed.URI;
const minutesInWorkDay = parsed.MINUTE_IN_WORK_DAY;

router.post("/generate", async function(req, res, next) {
  const app = global.app;

  const user = await app.models.User.findOne({
    token: req.header("Authorization")
  });

  if (user) {
    let aprovafyId = user.aprovafyId;
    let aprovafyUri = user.aprovafyUri;

    const spo = initSpotify(user);
    const usersAvailable = req.body.users;
    try {
      const songs = await getAllTracksFromPlaylist(req.body.source, spo);

      const byUser = _.groupBy(
        _.filter(songs, s => usersAvailable.indexOf(s.added_by.id) >= 0),
        s => s.added_by.id
      );

      const avgSongDurationMinutes = Math.ceil(
        _.sumBy(songs, s => s.track.duration_ms / 1000) / songs.length / 60
      );

      const songsByDay = Math.ceil(minutesInWorkDay / avgSongDurationMinutes);
      const songsByUser = songsByDay / usersAvailable.length;

      let songsToPlay = [];

      for (let i = 0; i < usersAvailable.length; i++) {
        const user = usersAvailable[i];
        let songsThisUser = _.take(_.shuffle(byUser[user]), songsByUser);

        songsToPlay = [...songsToPlay, ...songsThisUser];
      }

      songsToPlay = _.shuffle(songsToPlay);

      let idsSongs = songsToPlay.map(s => s.track.uri);

      const songsAprovafy = await getAllTracksFromPlaylist(aprovafyId, spo);

      if (songsAprovafy && songsAprovafy.length) {
        let tracks = _.map(songsAprovafy, i => {
          return { uri: i.track.uri };
        });

        const chunkRemove = _.chunk(tracks, 100);

        for (let i = 0; i < chunkRemove.length; i++) {
          const c = chunkRemove[i];

          await spo.removeTracksFromPlaylist(aprovafyId, c);
        }
      }

      const chunk = _.chunk(idsSongs, 10);

      for (let i = 0; i < chunk.length; i++) {
        const part = chunk[i];

        await spo.addTracksToPlaylist(aprovafyId, part);
      }

      const devices = await spo.getMyDevices();
      const myDevice = _.first(
        _.filter(devices.body.devices, d => d.is_active)
      );

      if (!myDevice) {
        throw new Error("Sem device");
      }

      await spo.play({
        device_id: myDevice.id,
        context_uri: aprovafyUri
      });

      res.send({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(400);
      res.send({ ok: false });
    }
  } else {
    res.status(400);
    res.send({ ok: false });
  }
});

router.get("/now-playing/", async function(req, res, next) {
  const app = global.app;

  const user = await app.models.User.findOne({
    token: req.header("Authorization")
  });

  if (user) {
    const spo = initSpotify(user);
    try {
      const nowPlaying = await spo.getMyCurrentPlayingTrack();

      const total = nowPlaying.body.item.duration_ms;
      const progress = nowPlaying.body.progress_ms;

      res.send({
        ok: true,
        track: nowPlaying.body.item,
        total,
        total,
        progress: progress
      });
    } catch (error) {
      console.error(error);
      res.status(400);
      res.send({ ok: false });
    }
  } else {
    res.status(400);
    res.send({ ok: false });
  }
});

router.get("/aprovafy/", async function(req, res, next) {
  const app = global.app;

  const user = await app.models.User.findOne({
    token: req.header("Authorization")
  });

  if (user) {
    const spo = initSpotify(user);
    try {
      const playlist = await spo.getPlaylist(user.aprovafyId);
      const songs = await getAllTracksFromPlaylist(user.aprovafyId, spo);

      playlist.body.tracks = songs;

      res.send({ ok: true, playlist: playlist.body });
    } catch (error) {
      console.error(error);
      res.status(400);
      res.send({ ok: false });
    }
  } else {
    res.status(400);
    res.send({ ok: false });
  }
});

router.get("/playlist/:id", async function(req, res, next) {
  const app = global.app;

  const user = await app.models.User.findOne({
    token: req.header("Authorization")
  });

  if (user) {
    const spo = initSpotify(user);
    try {
      const playlist = await spo.getPlaylist(req.params.id);
      const songs = await getAllTracksFromPlaylist(req.params.id, spo);

      playlist.body.tracks = songs;

      res.send({ ok: true, playlist: playlist.body });
    } catch (error) {
      console.error(error);
      res.status(400);
      res.send({ ok: false });
    }
  } else {
    res.status(400);
    res.send({ ok: false });
  }
});

router.get("/playlists", async function(req, res, next) {
  const app = global.app;

  const user = await app.models.User.findOne({
    token: req.header("Authorization")
  });

  if (user) {
    const spo = initSpotify(user);
    try {
      let hasPlaylsits = true;
      let allPlaylists = [];
      let page = 1;

      while (hasPlaylsits) {
        const playlists = await spo.getUserPlaylists({
          limit: 50,
          offset: page === 1 ? 0 : (page - 1) * 50
        });

        allPlaylists = [...allPlaylists, ...playlists.body.items];

        page++;

        if (!playlists.body.items || !playlists.body.items.length) {
          hasPlaylsits = false;
        }
      }

      allPlaylists = _.sortBy(allPlaylists, i => i.name);

      res.send({ ok: true, playlists: allPlaylists });
    } catch (error) {
      console.error(error);
      res.status(400);
      res.send({ ok: false });
    }
  } else {
    res.status(400);
    res.send({ ok: false });
  }
});

router.post("/callback", async function(req, res, next) {
  console.log(req);

  res.send({ ok: true });
});

router.post("/auth/:code", async function(req, res, next) {
  const app = global.app;

  // credentials are optional
  var spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: clientSecret,
    redirectUri: uri
  });

  try {
    const result = await spotifyApi.authorizationCodeGrant(req.params.code);

    const user = await app.models.User.findOne({
      token: req.header("Authorization")
    });

    if (user) {
      user.spotifyToken = result.body.access_token;
      user.refreshToken = result.body.refresh_token;

      await user.save();
    }
  } catch (error) {
    console.error("Uai");
    console.error(JSON.stringify(error));
  }

  res.send({
    ok: true
  });
});

router.get("/", async function(req, res, next) {
  const app = global.app;
  let state = shortid();

  let scope =
    "user-library-modify user-library-read app-remote-control streaming playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-follow-modify user-follow-read user-read-recently-played user-top-read user-read-private user-read-email user-read-currently-playing user-read-playback-state user-modify-playback-state";

  let url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    uri
  )}&scope=${encodeURIComponent(scope)}&state=${state}`;

  res.send({
    ok: true,
    url: url
  });
});

async function doRequest(url, method, data) {
  if (method === "get") {
    return await superagent[method](url)
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .set("Authorization", "Bearer " + oAuthToken);
  } else {
    return await superagent[method](url)
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .set("Authorization", "Bearer " + oAuthToken)
      .send(data);
  }
}

function initSpotify(user) {
  // credentials are optional
  var spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: clientSecret,
    redirectUri: uri,
    accessToken: user.spotifyToken,
    refreshToken: user.refreshToken
  });

  return spotifyApi;
}

async function getAllTracksFromPlaylist(id, spo) {
  let hasSongsPlaylist = true;
  let songsThisPlaylist = [];
  let pagePlaylist = 1;

  while (hasSongsPlaylist) {
    const currentSongsPage = await spo.getPlaylistTracks(id, {
      limit: 100,
      offset: pagePlaylist === 1 ? 0 : (pagePlaylist - 1) * 100
    });

    if (currentSongsPage.body.items.length) {
      songsThisPlaylist = [
        ...songsThisPlaylist,
        ...currentSongsPage.body.items
      ];
    } else {
      hasSongsPlaylist = false;
    }

    pagePlaylist++;
  }

  return songsThisPlaylist;
}

module.exports = router;
