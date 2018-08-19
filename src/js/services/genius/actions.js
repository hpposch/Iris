
var coreActions = require('../core/actions')
var uiActions = require('../ui/actions')
var helpers = require('../../helpers')

export function set(data){
    return {
        type: 'GENIUS_SET',
        data: data
    }
}

/**
 * Send an ajax request to the Genius API
 *
 * @param dispatch obj
 * @param getState obj
 * @param endpoint string = the url to query (ie /song/:id)
 * @param method string
 * @param data mixed = request payload
 * @return Promise
 **/
var sendRequest = (dispatch, getState, endpoint, method = 'GET', data = false) => {
    return new Promise((resolve, reject) => {

        if (endpoint.startsWith('https://') || endpoint.startsWith('http://')){
            var url = endpoint;
        } else {
            var url = 'https://api.genius.com/'+endpoint+'?access_token='+getState().genius.access_token;
        }

        // create our ajax request config
        var config = {
            method: method,
            url: url,
            timeout: 30000,
         	crossDomain: true
        }

        // only if we've got data do we add it to the request (this prevents appending of "&false" to the URL)
        if (data){
            if (typeof(data) === 'string'){
                config.data = data
            } else {
                config.data = JSON.stringify(data)
            }
        }

        // add reference to loader queue
        var loader_key = helpers.generateGuid();
        dispatch(uiActions.startLoading(loader_key, 'genius_'+endpoint));

        $.ajax(config).then(
                response => {
                    dispatch(uiActions.stopLoading(loader_key));

                    if (response.meta && response.meta.status >= 200 && response.meta.status < 300 && response.response){
                        resolve(response.response);
                    } else {
                        reject({
                            config: config,
                            xhr: xhr,
                            status: status,
                            error: error
                        });
                    }
                },
                (xhr, status, error) => {
                    dispatch(uiActions.stopLoading(loader_key));
                    reject({
                        config: config,
                        xhr: xhr,
                        status: status,
                        error: error
                    });
                }
            )
    });
}


/**
 * Handle authorization process
 **/

export function authorizationGranted(data){
    return {
        type: 'GENIUS_AUTHORIZATION_GRANTED',
        data: data
    }
}

export function revokeAuthorization(){
    return {
        type: 'GENIUS_AUTHORIZATION_REVOKED'
    }
}


/**
 * Get current user
 **/
export function getMe(){
    return (dispatch, getState) => {
        sendRequest(dispatch, getState, 'account')
            .then(
                response => {
                    dispatch({
                        type: 'GENIUS_ME_LOADED',
                        me: response.user
                    });
                },
                error => {
                    dispatch(coreActions.handleException(
                        'Could not load your Genius profile',
                        error
                    ));
                }
            );
    }
}

/**
 * Extract lyrics from a page
 * We don't get the lyrics in the API, so we need to 'scrape' the HTML page instead
 *
 * @param uri = track uri
 * @param path = String, the relative API path for the HTML lyrics
 **/
export function getTrackLyrics(uri, path){
    return (dispatch, getState) => {

        dispatch(coreActions.trackLoaded({
                uri: uri,
                lyrics: null,
                lyrics_path: null
            }));

        var config = {
            method: 'GET',
            url: '//'+getState().mopidy.host+':'+getState().mopidy.port+'/iris/http/get_lyrics',
            timeout: 10000
        }

        $.ajax(config)
            .then(
                (response, status, xhr) => {
                    var html = $(response);
                    var lyrics = html.find('.lyrics');
                    if (lyrics.length > 0){

                        lyrics = lyrics.first();
                        lyrics.find('a').replaceWith(function(){
                            return this.innerHTML;
                        });

                        var lyrics_html = lyrics.html();
                        lyrics_html = lyrics_html.replace(/(\[)/g, '<span class="grey-text">[');
                        lyrics_html = lyrics_html.replace(/(\])/g, ']</span>');

                        dispatch(coreActions.trackLoaded({
                                uri: uri,
                                lyrics: lyrics_html,
                                lyrics_path: path
                            }));
                    }

                },
                (xhr, status, error) => {
                    dispatch(coreActions.handleException(
                        'Could not get track lyrics',
                        error
                    ));
                }
            );
    }
}

export function findTrackLyrics(track){
    return (dispatch, getState) => {

        var query = '';
        query += track.artists[0].name+' ';
        query += track.name;
        query = query.toLowerCase();
        query = query.replace(/\([^)]*\) */g, '');        // anything in circle-braces
        query = query.replace(/\([^[]*\] */g, '');        // anything in square-braces

        sendRequest(dispatch, getState, 'search', 'GET', 'q='+encodeURIComponent(query))
            .then(
                response => {
                    if (response.hits && response.hits.length > 0){
                        var lyrics_results = [];
                        for (var i = 0; i < response.hits.length; i++){
                            lyrics_results.push({
                                title: response.hits[i].result.full_title,
                                url: response.hits[i].result.url,
                                path: response.hits[i].result.path
                            });
                        }
                        dispatch(coreActions.trackLoaded({
                                uri: track.uri,
                                lyrics_results: lyrics_results
                            }));

                        // Immediately go and get the first result's lyrics
                        var lyrics_result = lyrics_results[0];
                        dispatch(getTrackLyrics(track.uri, lyrics_result.path));
                    }
                },
                error => {
                    dispatch(coreActions.handleException(
                        'Could not search for track lyrics',
                        error
                    ));
                }
            );
    }
}
