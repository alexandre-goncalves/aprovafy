const _ = require("lodash");
const superAgent = require("superagent");
const usersAvailable = [
  "12178523159",
  // "rodolfoag2",
  // "massreuy",
  "wandson_camisa10"
];

let myUser = "12178523159";
let aprovafyPlaylist = "spotify:playlist:3J9VpbqbCb81lF2MgjRLrf";
let aprovafyId = "3J9VpbqbCb81lF2MgjRLrf";

let deviceId = "9e2cc90806917ab27f116b116bb1cc149685b0b2";
let oAuthToken =
  "BQDVnQL3YODckH1ZENBzjmweDAYT0Q425ng3HmCMDdxv6_MEXvmm-344mBkfZXUcLnrMf8E9RaJwxYpg7HLWJEj7C0eDXaB3T2iF4T4mO568uCtsm0ODlzcuOH3pZPAWQhEC3_54u2gGStHvGWCMd1Bnt7hfwdPANiAOSY3cJnB5nDDq2LxQxz8utYspzhethXlCMcmqDG4zae3yTeKLNVHJqxFgjDPW7ISWBpzgNzEH4PJ-nJQ8PdcRuNdpDN8o1dldYFM1hFVqZi_4mA";

async function doStuff() {
  let songs = [];
  let hasSongs = true;
  let page = 1;
  const playlistId = "6ckaI4mLafb0YiW3Y9dLHp";

  var SpotifyWebApi = require("spotify-web-api-node");

  // credentials are optional
  var spotifyApi = new SpotifyWebApi({
    clientId: "fdea1bf42f3f41fa839630599315f1ff",
    clientSecret: "bf2b88ed3256491aad931a4d2d64c57d"
    // redirectUri: "http://localhost:3005"
  });

  try {
    // const bla = await spotifyApi.authorizationCodeGrant(oAuthToken);

    const token = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(token.body.access_token);

    while (hasSongs) {
      const pagedSongs = await spotifyApi.getPlaylistTracks(playlistId, {
        offset: page === 1 ? 0 : (page - 1) * 100
      });

      if (!pagedSongs.body.items.length) {
        hasSongs = false;
      } else {
        songs = [...songs, ...pagedSongs.body.items];
      }

      page++;
    }

    const byUser = _.groupBy(
      _.filter(songs, s => usersAvailable.indexOf(s.added_by.id) >= 0),
      s => s.added_by.id
    );

    const avgSongDurationMinutes = Math.ceil(
      _.sumBy(songs, s => s.track.duration_ms / 1000) / songs.length / 60
    );

    const minutesInWorkDay = 60 * 10;

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
    let textsSongs = songsToPlay.map(s => `${s.added_by.id} - ${s.track.name}`);

    // let userDevices = await spotifyApi.getMyDevices();
    // console.log(userDevices);

    let hasSongsPlaylist = true;
    let songsThisPlaylist = [];
    let pagePlaylist = 1;

    while (hasSongsPlaylist) {
      const currentSongsPage = await doRequest(
        `https://api.spotify.com/v1/playlists/${aprovafyId}/tracks?limit=100&offset=${
          pagePlaylist === 1 ? 0 : (pagePlaylist - 1) * 100
        }`,
        "get",
        {}
      );

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

    if (songsThisPlaylist && songsThisPlaylist.length) {
      let tracks = _.map(songsThisPlaylist, i => {
        return { uri: i.track.uri };
      });

      const chunkRemove = _.chunk(tracks, 100);

      for (let i = 0; i < chunkRemove.length; i++) {
        const c = chunkRemove[i];

        await doRequest(
          `https://api.spotify.com/v1/playlists/${aprovafyId}/tracks`,
          "delete",
          {
            tracks: c
          }
        );
      }
    }

    const chunk = _.chunk(idsSongs, 10);

    for (let i = 0; i < chunk.length; i++) {
      const part = chunk[i];

      await doRequest(
        `https://api.spotify.com/v1/playlists/${aprovafyId}/tracks?uris=${part.join(
          ","
        )}`,
        "post",
        {}
      );
    }

    for (let i = 0; i < textsSongs.length; i++) {
      const s = textsSongs[i];
      console.log(s);
    }

    await doRequest(
      "https://api.spotify.com/v1/me/player/play?device_id=" + deviceId,
      "put",
      {
        context_uri: aprovafyPlaylist
      }
    );
  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}

async function doRequest(url, method, data) {
  if (method === "get") {
    return await superAgent[method](url)
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .set("Authorization", "Bearer " + oAuthToken);
  } else {
    return await superAgent[method](url)
      .set("Accept", "application/json")
      .set("Content-Type", "application/json")
      .set("Authorization", "Bearer " + oAuthToken)
      .send(data);
  }
}

doStuff();
