
import ReactGA from 'react-ga'

var coreActions = require('./actions.js');
var uiActions = require('../ui/actions.js');
var pusherActions = require('../pusher/actions.js');
var mopidyActions = require('../mopidy/actions.js');
var spotifyActions = require('../spotify/actions.js');
var lastfmActions = require('../lastfm/actions.js');
var helpers = require('../../helpers.js');

const CoreMiddleware = (function(){

    /**
     * The actual middleware inteceptor
     **/
    return store => next => action => {
        var core = store.getState().core;

        switch(action.type){

            case 'HANDLE_EXCEPTION':

                // Construct meaningful message and description
                var message = action.message;
                if (action.description){
                    var description = action.description;
                } else if (action.data.xhr && action.data.xhr.responseText){
                    var xhr_response = JSON.parse(action.data.xhr.responseText);
                    if (xhr_response.error && xhr_response.error.message){
                        var description = xhr_response.error.message;
                    }
                } else if (action.data.xhr){
                    var description = action.data.xhr.status+' '+action.data.xhr.statusText;
                } else {
                    var description = null;
                }

                // Prepare a summary dump of our state
                var state = store.getState();
                var exported_state = {
                    core: Object.assign({},state.core),
                    ui: Object.assign({},state.ui),
                    spotify: Object.assign({},state.spotify),
                    mopidy: Object.assign({},state.mopidy),
                    pusher: Object.assign({},state.pusher)
                }

                // Strip out non-essential store info
                delete exported_state.core.albums
                delete exported_state.core.artists
                delete exported_state.core.playlists
                delete exported_state.core.users
                delete exported_state.core.queue_metadata
                delete exported_state.core.current_tracklist
                delete exported_state.spotify.library_albums
                delete exported_state.spotify.library_artists
                delete exported_state.spotify.library_playlists
                delete exported_state.spotify.autocomplete_results
                delete exported_state.mopidy.library_albums
                delete exported_state.mopidy.library_artists
                delete exported_state.mopidy.library_playlists

                var data = Object.assign(
                    {},
                    action.data,
                    {
                        message: message,
                        description: description,
                        state: exported_state
                    }
                );

                // Log with Analytics
                if (store.getState().ui.allow_reporting){
	                ReactGA.event({
	                    category: "Error",
	                    action: message,
	                    label: description,
	                    nonInteraction: true
	                });
	            }

	            if (action.show_notification){
	                store.dispatch(uiActions.createNotification({content: message, type: 'bad', description: description}));
	            }

                console.error(message, description, data);
                
                break;

            case 'PLAY_PLAYLIST':
                if (store.getState().ui.allow_reporting){
	                ReactGA.event({ category: 'Playlist', action: 'Play', label: action.uri });
	            }
                next(action)
                break

            case 'SAVE_PLAYLIST':
                if (store.getState().ui.allow_reporting){
              		ReactGA.event({ category: 'Playlist', action: 'Save', label: action.key });
	            }
                next(action)
                break

            case 'CREATE_PLAYLIST':
                if (store.getState().ui.allow_reporting){
                	ReactGA.event({ category: 'Playlist', action: 'Create', label: +action.name });
	            }
                next(action)
                break

            case 'REORDER_PLAYLIST_TRACKS':
                if (store.getState().ui.allow_reporting){
                	ReactGA.event({ category: 'Playlist', action: 'Reorder tracks', label: action.key });
	            }
                next(action)
                break

            case 'ADD_PLAYLIST_TRACKS':
                if (store.getState().ui.allow_reporting){
                	ReactGA.event({ category: 'Playlist', action: 'Add tracks', label: action.playlist_uri });
	            }
                next(action)
                break

            case 'REMOVE_PLAYLIST_TRACKS':
                if (store.getState().ui.allow_reporting){
                	ReactGA.event({ category: 'Playlist', action: 'Remove tracks', label: action.playlist_uri });
	            }
                next(action)
                break

            case 'DELETE_PLAYLIST':
                if (store.getState().ui.allow_reporting){
                	ReactGA.event({ category: 'Playlist', action: 'Delete', label: action.uri });
	            }
                next(action)
                break

            case 'SEARCH_STARTED':
                if (store.getState().ui.allow_reporting){
                	ReactGA.event({ category: 'Search', action: 'Started', label: action.type+': '+action.query });
	            }
                next(action)

                var state = store.getState()
                if (state.ui.search_uri_schemes){
                    var uri_schemes = state.ui.search_uri_schemes
                } else {
                    var uri_schemes = state.mopidy.uri_schemes
                }

                // backends that can handle more than just track results
                // make sure they are available and respect our settings
                var available_full_uri_schemes = ['local:','file:','gmusic:']
                var full_uri_schemes = []
                for (var i = 0; i < available_full_uri_schemes.length; i++){
                    var index = uri_schemes.indexOf(available_full_uri_schemes[i])
                    if (index > -1){
                        full_uri_schemes.push(available_full_uri_schemes[i])
                    }
                }

                // initiate spotify searching
                if (!action.only_mopidy){
                    if (!state.ui.search_settings || state.ui.search_settings.spotify){
                        store.dispatch(spotifyActions.getSearchResults(action.query))
                    }
                }

                // backend searching (mopidy)
                if (state.mopidy.connected){
                    store.dispatch(mopidyActions.getSearchResults(action.search_type, action.query, 100, full_uri_schemes))
                }

                break

            case 'PLAYLIST_TRACKS_ADDED':
                store.dispatch(uiActions.createNotification({type: 'info', content: 'Added '+action.tracks_uris.length+' tracks to playlist'}))
                switch(helpers.uriSource(action.key)){

                    case 'spotify':
                        store.dispatch(spotifyActions.getPlaylist(action.key));
                        break

                    case 'm3u':
                        if (store.getState().mopidy.connected ) store.dispatch(mopidyActions.getPlaylist(action.key));
                        break
                }
                next(action)
                break

            // Get assets from all of our providers
            case 'GET_LIBRARY_PLAYLISTS':
                if (store.getState().spotify.connected){
                    store.dispatch(spotifyActions.getLibraryPlaylists())
                }
                if (store.getState().mopidy.connected){
                    store.dispatch(mopidyActions.getLibraryPlaylists())
                }
                next(action)
                break

            // Get assets from all of our providers
            case 'GET_LIBRARY_ALBUMS':
                if (store.getState().spotify.connected){
                    store.dispatch(spotifyActions.getLibraryAlbums())
                }
                if (store.getState().mopidy.connected){
                    store.dispatch(mopidyActions.getLibraryAlbums())
                }
                next(action)
                break

            // Get assets from all of our providers
            case 'GET_LIBRARY_ARTISTS':
                if (store.getState().spotify.connected){
                    store.dispatch(spotifyActions.getLibraryArtists())
                }
                if (store.getState().mopidy.connected){
                    store.dispatch(mopidyActions.getLibraryArtists())
                }
                next(action)
                break

            case 'RESTART':
                location.reload();
                break;


            /**
             * Playlist manipulation
             **/

            case 'PLAYLIST_TRACKS':
                var tracks = helpers.formatTracks(action.tracks);
                action.tracks_uris = helpers.arrayOf('uri', tracks);

                store.dispatch({
                    type: 'TRACKS_LOADED',
                    tracks: tracks
                });

                next(action);
                break;

            case 'PLAYLIST_TRACKS_REORDERED':
                var playlists = Object.assign({}, core.playlists);
                var playlist = Object.assign({}, playlists[action.key]);
                var tracks_uris = Object.assign([], playlist.tracks_uris);

                // handle insert_before offset if we're moving BENEATH where we're slicing tracks
                var insert_before = action.insert_before
                if (insert_before > action.range_start){
                    insert_before = insert_before - action.range_length;
                }

                // cut our moved tracks into a new array
                var tracks_to_move = tracks_uris.splice(action.range_start, action.range_length)
                tracks_to_move.reverse()

                for (i = 0; i < tracks_to_move.length; i++){
                    tracks_uris.splice(insert_before, 0, tracks_to_move[i])
                }

                var snapshot_id = null;
                if (action.snapshot_id){
                    snapshot_id = action.snapshot_id;
                }

                // Update our playlist
                playlist.tracks_uris = tracks_uris;
                playlist.snapshot_id = snapshot_id;

                // Trigger normal playlist updating
                store.dispatch({
                    type: 'PLAYLISTS_LOADED',
                    playlists: [playlist]
                });
                break;

            case 'PLAYLIST_TRACKS_REMOVED':
                var playlists = Object.assign({}, core.playlists);
                var playlist = Object.assign({}, playlists[action.key]);
                var tracks_uris = Object.assign([], playlist.tracks_uris);

                var indexes = action.tracks_indexes.reverse()
                for(var i = 0; i < indexes.length; i++){
                    tracks_uris.splice(indexes[i], 1);
                }

                var snapshot_id = null;
                if (action.snapshot_id){
                    snapshot_id = action.snapshot_id;
                }

                // Update our playlist
                playlist.tracks_uris = tracks_uris;
                playlist.snapshot_id = snapshot_id;

                // Trigger normal playlist updating
                store.dispatch({
                    type: 'PLAYLISTS_LOADED',
                    playlists: [playlist]
                });
                break;


            /**
             * Asset Load commands
             *
             * These are called from views and other middleware to load
             * assets. This is where we can return already indexed records
             * where appropriate
             **/

            case 'LOAD_TRACK':
            	if (
            		!action.force_reload &&
            		store.getState().core.tracks[action.uri]){
	            		console.info('Loading "'+action.uri+'" from index');
	            		break;
            	}
            	
                switch (helpers.uriSource(action.uri)){
                    case 'spotify':
                        store.dispatch(spotifyActions.getTrack(action.uri));
                        
                        if (store.getState().spotify.me){
	                        store.dispatch(spotifyActions.following(action.uri));
	                    }
                        break;

                    default:
                        if (store.getState().mopidy.connected){
                            store.dispatch(mopidyActions.getTrack(action.uri));
                        }
                        break;
                }

                next(action);
                break;

            case 'LOAD_ALBUM':
            	if (
            		!action.force_reload &&
            		store.getState().core.albums[action.uri] && 
            		store.getState().core.albums[action.uri].tracks_uris){
	            		console.info('Loading "'+action.uri+'" from index');
	            		break;
            	}
            	
                switch (helpers.uriSource(action.uri)){
                    case 'spotify':
                        store.dispatch(spotifyActions.getAlbum(action.uri));
                        
                        if (store.getState().spotify.me){
	                        store.dispatch(spotifyActions.following(action.uri));
	                    }
                        break;

                    default:
                        if (store.getState().mopidy.connected){
                            store.dispatch(mopidyActions.getAlbum(action.uri));
                        }
                        break;
                }

                next(action);
                break;

            case 'LOAD_ARTIST':
            	if (
            		!action.force_reload &&
            		store.getState().core.artists[action.uri] && 
            		store.getState().core.artists[action.uri].albums_uris && 
            		store.getState().core.artists[action.uri].tracks_uris){
	            		console.info('Loading "'+action.uri+'" from index');
	            		break;
            	}

                switch (helpers.uriSource(action.uri)){
                    case 'spotify':
                        store.dispatch(spotifyActions.getArtist(action.uri, true));
                        
                        if (store.getState().spotify.me){
	                        store.dispatch(spotifyActions.following(action.uri));
	                    }
                        break;

                    default:
                        if (store.getState().mopidy.connected){
                            store.dispatch(mopidyActions.getArtist(action.uri));
                        }
                        break;
                }

                next(action);
                break;

            case 'LOAD_PLAYLIST':
            	if (
            		!action.force_reload &&
            		store.getState().core.playlists[action.uri] && 
            		store.getState().core.playlists[action.uri].tracks_uris){
	            		console.info('Loading "'+action.uri+'" from index');
	            		break;
            	}

                switch (helpers.uriSource(action.uri)){
                    case 'spotify':
                        store.dispatch(spotifyActions.getPlaylist(action.uri));

                        if (store.getState().spotify.me){
	                        store.dispatch(spotifyActions.following(action.uri));
	                    }
                        break;

                    default:
                        if (store.getState().mopidy.connected){
                            store.dispatch(mopidyActions.getPlaylist(action.uri));
                        }
                        break;
                }

                next(action);
                break;

            case 'LOAD_USER':
            	if (
            		!action.force_reload &&
            		store.getState().core.users[action.uri] &&
            		store.getState().core.users[action.uri].playlists_uris ){
	            		console.info('Loading "'+action.uri+'" from index');
	            		break;
            	}

                switch (helpers.uriSource(action.uri)){
                    case 'spotify':
						store.dispatch(spotifyActions.getUser(action.uri));
                        
                        if (store.getState().spotify.me){
	                        store.dispatch(spotifyActions.following(action.uri));
	                    }
                        break;

                    default:
                        // No Mopidy mechanism for users
                        break;
                }

                next(action);
                break;

            case 'LOAD_USER_PLAYLISTS':
                if (
                    !action.force_reload &&
                    store.getState().core.users[action.uri] &&
                    store.getState().core.users[action.uri].playlists_uris ){
                        console.info('Loading "'+action.uri+'" playlists from index');
                        break;
                }

                switch (helpers.uriSource(action.uri)){
                    case 'spotify':
						store.dispatch(spotifyActions.getUserPlaylists(action.uri));
                        break;

                    default:
                        // No Mopidy mechanism for users
                        break;
                }

                next(action);
                break;


            /**
             * Index actions
             * These modify our asset indexes, which are used globally
             **/

            case 'CURRENT_TRACK_LOADED':
                store.dispatch(coreActions.trackLoaded(action.track));
                action.track = helpers.formatTrack(action.track);
                next(action);
                break;

            case 'QUEUE_LOADED':
                store.dispatch(coreActions.tracksLoaded(action.tracks));
                action.tracks = helpers.formatTracks(action.tracks);
                next(action);
                break;

            case 'TRACKS_LOADED':
                var tracks_index = Object.assign({}, core.tracks);
                var artists_index = core.artists;
                var albums_index = core.albums;
                var tracks_loaded = [];
                var artists_loaded = [];
                var albums_loaded = [];

                for (var raw_track of action.tracks){
                    var track = helpers.formatTrack(raw_track);

                    if (tracks_index[track.uri] !== undefined){
                        track = Object.assign({}, tracks_index[track.uri], track);
                    }
                    
                    if (raw_track.album){
                        track.album = helpers.formatSimpleObject(raw_track.album);

                        if (!albums_index[raw_track.album.uri]){
                            albums_loaded.push(raw_track.album);
                        }

                        // Copy the images to the track
                        /*
                        if (raw_track.album.images){
                            track.images = helpers.digestMopidyImages(store.getState().mopidy, raw_track.album.images);
                        }*/
                    }

                    if (raw_track.artists && raw_track.artists.length > 0){
                        track.artists = [];

                        for (var artist of raw_track.artists){
                            track.artists.push(helpers.formatSimpleObject(artist));

                            // Not already in our index, so let's add it
                            if (!artists_index[artist.uri]){
                                artists_loaded.push(artist);
                            }
                        }
                    }

                    tracks_loaded.push(track);
                };

                action.tracks = tracks_loaded;

                if (artists_loaded.length > 0){
                    store.dispatch(coreActions.artistsLoaded(artists_loaded));
                }
                if (albums_loaded.length > 0){
                    store.dispatch(coreActions.albumsLoaded(albums_loaded));
                }

                next(action);
                break;

            case 'ALBUMS_LOADED':
                var albums_index = Object.assign({}, core.albums);
                var albums_loaded = [];
                var artists_loaded = [];
                var tracks_loaded = [];

                for (var raw_album of action.albums){
                    var album = helpers.formatAlbum(raw_album);

                    if (albums_index[album.uri]){
                        album = Object.assign({}, albums_index[album.uri], album);
                    }
/*
                    if (raw_album.images && raw_album.images.length > 0){
                        album.images = helpers.digestMopidyImages(store.getState().mopidy, raw_album.images);
                    }*/

                    if (raw_album.tracks){
                        album.tracks_uris = [];

                        for (var track of raw_album.tracks){
                            if (!track.album){
                                track.album = helpers.formatSimpleObject(album);
                            }
                            album.tracks_uris.push(track.uri);
                            tracks_loaded.push(track);
                        }
                    }

                    if (raw_album.artists){
                        album.artists_uris = helpers.arrayOf('uri', raw_album.artists);
                        artists_loaded = [...artists_loaded, ...raw_album.artists];
                    }

                    albums_loaded.push(album);
                };

                action.albums = albums_loaded;

                if (artists_loaded.length > 0){
                    store.dispatch(coreActions.artistsLoaded(artists_loaded));
                }
                if (tracks_loaded.length > 0){
                    store.dispatch(coreActions.tracksLoaded(tracks_loaded));
                }

                next(action);
                break

            case 'ARTISTS_LOADED':
                var artists_index = Object.assign({}, core.artists);
                var artists_loaded = [];
                var tracks_loaded = [];
                
                for (var raw_artist of action.artists){
                	var artist = helpers.formatArtist(raw_artist);

                	// Already have an artist in the index
                    if (artists_index[artist.uri]){

                    	// And we've already got some images, make sure we merge the arrays,
                    	// rather than overwriting
                    	if (artists_index[artist.uri].images && artist.images){
                    		var existing_images = artists_index[artist.uri].images;
                    		var are_new_images = true;

                    		// loop all extisting images to make sure we're not adding one that
                    		// we already have
                    		for (var existing_image of existing_images){

                    			// We only need to check one size, the formatter should insist on consistency
                    			// Note that we depend on having a one-item array of images provided per action
                    			if (existing_image.huge == artist.images[0].huge){
                    				are_new_images = false;
                    			}
                    		}

                    		// Only if they're new images should we merge them in
                    		if (are_new_images){
	                    		artist.images = Object.assign([], [...existing_images, ...artist.images]);
	                    	}
                    	}

                        artist = Object.assign({}, artists_index[artist.uri], artist);
                    }

                    // Migrate nested tracks objects into references to our tracks index
                    if (raw_artist.tracks){
                        var tracks = helpers.formatTracks(raw_artist.tracks);
                        var tracks_uris = helpers.arrayOf('uri', tracks);
                        artist.tracks_uris = tracks_uris;
                        tracks_loaded = [...tracks_loaded, ...tracks];
                    }

                    artists_loaded.push(artist);
                };

                action.artists = artists_loaded;

                if (tracks_loaded.length > 0){
                    store.dispatch(coreActions.tracksLoaded(tracks_loaded));
                }

                next(action);
                break;

            case 'PLAYLISTS_LOADED':
                var playlists_index = Object.assign({}, core.playlists);
                var playlists_loaded = [];
                var tracks_loaded = [];

                for (var playlist of action.playlists){

                	playlist = helpers.formatPlaylist(playlist);

                    // Detect editability
                    switch (helpers.uriSource(playlist.uri)){

                        case 'm3u':
                            playlist.can_edit = true
                            break

                        case 'spotify':
                            if (store.getState().spotify.authorization && store.getState().spotify.me){
                                playlist.can_edit = (playlist.owner.id == store.getState().spotify.me.id)
                            }
                    }

                    // Already have this playlist partially in our index
                    if (playlists_index[playlist.uri]){
                        playlist = Object.assign({}, playlists_index[playlist.uri], playlist);

                        // Setup placeholder tracks_uris
                        if (playlist.tracks_uris === undefined){
                            playlist.tracks_uris = [];
                        }
                    }

                    // Load our tracks
                    if (playlist.tracks){
                        var tracks = helpers.formatTracks(playlist.tracks);
                        var tracks_uris = helpers.arrayOf('uri', tracks);
                        playlist.tracks_uris = tracks_uris;
                        delete playlist.tracks;
                        tracks_loaded = [...tracks_loaded, ...tracks];
                    }

                    // Update index
                    playlists_loaded.push(playlist);
                }

                action.playlists = playlists_loaded;

                if (tracks_loaded.length > 0){
                    store.dispatch(coreActions.tracksLoaded(tracks_loaded));
                }

                next(action);
                break;

            case 'USERS_LOADED':
                var users_index = Object.assign({}, core.users);
                var users_loaded = [];

                for (var user of action.users){
                    user = helpers.formatUser(user);
                    
                    if (users_index[user.uri]){
                        user = Object.assign({}, users_index[user.uri], user);
                    }

                    users_loaded.push(user);
                }

                action.users = users_loaded;

                next(action);
                break;

            case 'USER_PLAYLISTS_LOADED':
            	store.dispatch(coreActions.playlistsLoaded(action.playlists));
                next(action);
                break;

            /**
             * Loaded more linked assets
             * Often fired during lazy-loading or async asset grabbing.
             * We link the parent to these indexed records by {type}s_uris
             **/

            case 'LOADED_MORE':
                var parent_type_plural = action.parent_type+'s';
                var parent_index = Object.assign({}, core[action.parent_type+'s']);
                var parent = Object.assign({}, parent_index[action.parent_key]);

                if (action.records_data.items !== undefined){
                    var records = action.records_data.items;
                } else if (action.records_data.tracks !== undefined){
                    var records = action.records_data.tracks;
                } else if (action.records_data.artists !== undefined){
                    var records = action.records_data.artists;
                } else if (action.records_data.albums !== undefined){
                    var records = action.records_data.albums;
                } else if (action.records_data.playlists !== undefined){
                    var records = action.records_data.playlists;
                } else {
                    var records = action.records_data;
                }

                // Pre-emptively format tracks
                // Providers give us tracks in all kinds of structures, so this cleans things first
                if (action.records_type == 'track'){
                    records = helpers.formatTracks(records);
                }

                var records_type_plural = action.records_type+'s';
                var records_index = {};
                var records_uris = helpers.arrayOf('uri', records);

                // If we're a list of playlists, we need to manually filter Spotify's new URI structure
                // Really poor form because they haven't updated it everywhere, yet
                if (action.records_type == 'playlist'){
                	records_uris = helpers.upgradeSpotifyPlaylistUris(records_uris);
                }

                // Append our parent object's reference to these records
                var uris = records_uris;
                if (parent[records_type_plural+'_uris'] !== undefined){
                    uris = [...parent[records_type_plural+'_uris'], ...uris];
                }
                parent[records_type_plural+'_uris'] = uris;
                if (action.records_data.next !== undefined){
                    parent[records_type_plural+'_more'] = action.records_data.next;
                }

                // Parent loaded (well, changed)
                var parent_action = {
                    type: parent_type_plural.toUpperCase()+'_LOADED'
                };
                parent_action[parent_type_plural] = [parent];
                store.dispatch(parent_action);

                // Records loaded
                var records_action = {
                    type: records_type_plural.toUpperCase()+'_LOADED'
                };
                records_action[records_type_plural] = records;
                store.dispatch(records_action);

                next(action);
                break;

            // This action is irrelevant to us, pass it on to the next middleware
            default:
                return next(action)
        }
    }

})();

export default CoreMiddleware
