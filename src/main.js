const API_HOST = 'http://ws.audioscrobbler.com'
const API_KEY = 'ec2df420326473165440f7219559bb29'
const ENDPOINT_PREFIX = API_HOST + '/2.0/?method='
const ENDPOINT_SUFFIX = '&api_key=' + API_KEY + '&format=json'

var ANIMATE_DURATION = 500;

var RADIUS_ARTIST = 24;
var RADIUS_ALBUM = 16;
var RADIUS_SONG = 4;

var LINK_DISTANCE = 100;
var LINK_VALUE = 1.0;
var MAGNIFY = 2.0
var NODE_PADDING = 30;
var WIDTH = 1160;
var HEIGHT = 600;
var ARTIST_CHARGE = -200;
var SEARCH_CHARGE = -100;

var MAX_SEARCH_RESULTS = 20;
var MAX_SIMILAR_RESULTS = 20;
var MAX_ALBUM_RESULTS = 30;

var _usePacking = true;

var _force;
var _svg;
var _apiClient;
var _products;

var _lastSearchString;
var _linkedByIndex;
var _searchMode;
var _searchTimer;

window.addEvent('domready', function() {

    $('no-overlap-checkbox').addEvent('click', function(e) {
        _usePacking = $('no-overlap-checkbox').checked;
        console.log("overlap= " + _usePacking);
        update();
    });

    $("searchBox").addEvent('keydown', function() {
        // cancel any previously-set timer
        if (_searchTimer) {
            clearTimeout(_searchTimer);
        }

        _searchTimer = setTimeout(function() {
            executeSearch();
        }, 400);
    });
});

function initApp() {
    $('no-overlap-checkbox').checked = _usePacking;

    _apiClient = new ApiClient();

    initForce(WIDTH, HEIGHT);

    _svg = d3.select("#map").append("svg")
        .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
        .attr("preserveAspectRatio", "xMinYMin")
        .style("pointer-events", "all")
        .append("g")
        .call(d3.behavior.zoom().on("zoom", redraw))
        .append("g");

    _svg.append("svg:rect")
        .attr("width", WIDTH)
        .attr("height", HEIGHT);
}

function initForce(width, height) {
    _force = d3.layout.force()
        .size([width, height])
        .linkDistance(LINK_DISTANCE)
        .gravity(0.05)
        .charge(SEARCH_CHARGE);

    _force.on("tick", tick);
    _force.on("end", end);

    _force.drag().on("dragstart", dragstart);
    _force.drag().on("dragend", dragend);
}

function redraw() {
    _svg.attr("transform",
        "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")");
}

function linkExists(links, node1, node2) {
    //console.log("checking " + links.length + " links");

    for (var i = 0; i < links.length; i++) {
        var link = links[i];

        if (((link.source.id == node1.id) && (link.target.id == node2.id)) ||
            ((link.source.id == node2.id) && (link.target.id == node1.id))) {
            return true;
        }
    }

    return false;
}

function update() {
    if (!_products) {
        return;
    }

    var links = new Array();

    for (var i = 0; i < _products.length; i++) {
        var artist1 = _products[i];

        for (var j = 0; j < _products.length; j++) {
            var artist2 = _products[j];

            if (artist1.id != artist2.id && !linkExists(links, artist1, artist2) && hasRelationship(artist1, artist2)) {
                links.push({
                    source: artist1,
                    target: artist2,
                    value: LINK_VALUE
                });
            }
        }
    }

    // for (var i=0; i<links.length; i++)
    // {
    // 	console.log("link[" + i + "]= " + links[i].source.name + " to " + links[i].target.name);
    // }

    //console.log("------end---------links: " + links.length);

    _force
        .nodes(_products)
        .links(links)
        .charge(function(node) {
            return _searchMode ? SEARCH_CHARGE : ARTIST_CHARGE;
        })
        .start();

    updateLinks(links);
    updateNodes(_products);

    var node = _svg.selectAll(".node");
    var link = _svg.selectAll(".link");

    addInteractions(node, link, links);
}

function updateLinks(links) {
    // Update the links…
    var link = _svg.selectAll(".link").data(links, function(d) {
        return d.source.id + "-" + d.target.id;
    });

    // Exit any old links.
    link.exit().remove();

    // Enter any new links.
    link.enter().insert("line", ".node")
        .attr("class", "link")
        .attr("x1", function(d) {
            return d.source.x;
        })
        .attr("y1", function(d) {
            return d.source.y;
        })
        .attr("x2", function(d) {
            return d.target.x;
        })
        .attr("y2", function(d) {
            return d.target.y;
        });
}

function nodeSize(node) {
    console.log("node.artist", node.artist);
    console.log("node.album", node.album);
    console.log("node.song", node.song);

    return node.artist ? node.radius * 1.4 : node.album ? node.radius * 0.5 : node.radius;
}

function updateNodes(nodes) {
    // Update the nodes…
    var node = _svg.selectAll(".node").data(nodes, function(d) {
        return d.id;
    });

    // Exit any old nodes.
    node.exit().remove();

    var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .on("click", click)
        .call(_force.drag);

    nodeEnter.filter(function(d) {
            return d.type == "artist";
        })
        .append("circle")
        .attr("r", function(d) {
            return nodeSize(d) + 2;
        });

    nodeEnter.filter(function(d) {
            return d.type != "artist";
        })
        .append("rect")
        .attr("width", function(d) {
            return nodeSize(d) + 4;
        })
        .attr("height", function(d) {
            return nodeSize(d) * 2 + 4;
        })
        .attr("x", function(d) {
            return -nodeSize(d) - 2;
        })
        .attr("y", function(d) {
            return -nodeSize(d) - 2;
        });

    nodeEnter.filter(function(d) {
            return d.type == "artist";
        })
        .append("clipPath")
        .attr('id', function(d, i) {
            return "clip" + d.id
        })
        .append("circle")
        .attr("class", "clip-path")
        .attr("r", function(d) {
            return nodeSize(d);
        });

    nodeEnter.append("svg:image")
        .attr("class", function(d) {
            return d.type != "artist" ? "rect" : "circle";
        })
        .attr("xlink:href", function(d) {
            return d.imageUrl;
        })
        .attr("clip-path", function(d, i) {
            return "url(#clip" + d.id + ")";
        })
        .attr("x", function(d) {
            return -nodeSize(d);
        })
        .attr("y", function(d) {
            return -nodeSize(d);
        })
        .attr("width", function(d) {
            return nodeSize(d) * 2;
        })
        .attr("height", function(d) {
            return nodeSize(d) * 2;
        });

    nodeEnter.append("text")
        .attr("class", "shadow")
        .attr("y", function(d) {
            return nodeSize(d) + 6;
        })
        .attr("dy", ".35em")
        .style("font-size", function(d) {
            return d.type == "song" ? "6px" : "9px"
        })
        .text(function(d) {
            return d.name
        });

    nodeEnter.append("text")
        .attr("y", function(d) {
            return nodeSize(d) + 6;
        })
        .attr("dy", ".35em")
        .style("font-size", function(d) {
            return d.type == "song" ? "6px" : "9px"
        })
        .text(function(d) {
            return d.name
        });

    // node.each(function(d)
    // {
    // 	console.log("product name: " + d.name);
    // });
}

function tick() {
    var link = _svg.selectAll(".link");

    link.attr("x1", function(d) {
            return d.source.x;
        })
        .attr("y1", function(d) {
            return d.source.y;
        })
        .attr("x2", function(d) {
            return d.target.x;
        })
        .attr("y2", function(d) {
            return d.target.y;
        });

    var node = _svg.selectAll(".node");

    node.attr("transform", function(d) {
        return "translate(" + d.x + "," + d.y + ")";
    });

    if (_usePacking) {
        node.each(collide(0.1));
    }
}

function end() {
    //console.log("end");
}

d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
        this.parentNode.appendChild(this);
    });
};

function addInteractions(node, link, links) {
    node.on("mouseover", mouseOver);
    node.on("mouseout", mouseOut);

    _linkedByIndex = new Array();

    links.forEach(function(d) {
        _linkedByIndex[d.source.index + "," + d.target.index] = 1;
    });
}

function isConnected(a, b) {
    return _linkedByIndex[a.index + "," + b.index] || _linkedByIndex[b.index + "," + a.index];
}

function mouseOver(d) {
    var node = _svg.selectAll(".node");
    var link = _svg.selectAll(".link");

    var selection = d3.select(this);

    selection.moveToFront();

    node.classed("node-active", function(o) {
        thisOpacity = o.type != "song" && isConnected(d, o) ? true : false;
        this.setAttribute('fill-opacity', thisOpacity);
        return thisOpacity;
    });

    link.classed("link-active", function(o) {
        return o.source === d || o.target === d ? true : false;
    });

    console.log("mouseover: " + d.type);

    if (d.type == "artist") {
        selection.selectAll("circle").transition()
            .duration(ANIMATE_DURATION)
            .attr("r", function() {
                return d3.select(this).classed("clip-path") ? nodeSize(d) * MAGNIFY : (nodeSize(d) + 2) * MAGNIFY;
            });
    } else if (d.type == "album") {
        selection.selectAll("rect").transition()
            .duration(ANIMATE_DURATION)
            .attr("width", function() {
                return (nodeSize(d) + 2) * 2 * MAGNIFY;
            })
            .attr("height", function() {
                return (nodeSize(d) + 2) * 2 * MAGNIFY;
            })
            .attr("x", (-nodeSize(d) - 2) * MAGNIFY)
            .attr("y", (-nodeSize(d) - 2) * MAGNIFY);
    }

    selection.select("image").transition()
        .duration(ANIMATE_DURATION)
        .attr("x", -nodeSize(d) * MAGNIFY)
        .attr("y", -nodeSize(d) * MAGNIFY)
        .attr("width", (nodeSize(d) * 2) * MAGNIFY)
        .attr("height", (nodeSize(d) * 2) * MAGNIFY);

    selection.selectAll("text").transition()
        .duration(ANIMATE_DURATION)
        .attr("y", (nodeSize(d) + 2) * MAGNIFY + 6)
        .style("font-size", function(d) {
            return d.type == "song" ? "13.33px" : "20px"
        })
        .style("font-family", function(d) {
            return d.type == "artist" ? "LatoLatinWebLight" : "LatoLatinWebThin"
        })
}

function mouseOut(d) {
    var node = _svg.selectAll(".node");
    var link = _svg.selectAll(".link");

    var selection = d3.select(this);

    node.classed("node-active", false);
    link.classed("link-active", false);

    if (d.type == "artist") {
        selection.selectAll("circle").transition()
            .duration(ANIMATE_DURATION)
            .attr("r", function() {
                return d3.select(this).classed("clip-path") ? nodeSize(d) : nodeSize(d) + 2;
            });
    } else if (d.type == "album") {
        selection.selectAll("rect").transition()
            .duration(ANIMATE_DURATION)
            .attr("width", nodeSize(d) * 2 + 4)
            .attr("height", nodeSize(d) * 2 + 4)
            .attr("x", -nodeSize(d) - 2)
            .attr("y", -nodeSize(d) - 2);
    }

    selection.select("image").transition()
        .duration(ANIMATE_DURATION)
        .attr("x", -nodeSize(d))
        .attr("y", -nodeSize(d))
        .attr("width", nodeSize(d) * 2)
        .attr("height", nodeSize(d) * 2);

    selection.selectAll("text").transition()
        .duration(ANIMATE_DURATION)
        .attr("y", nodeSize(d) + 6)
        .style("font-size", function(d) {
            return d.type == "song" ? "6px" : "9px"
        })
}

function dragstart(d, i) {
    d3.event.sourceEvent.stopPropagation();
}

function dragend(d, i) {
    var e = d3.event.sourceEvent;

    if (!d.fixed && e.shiftKey) {
        d3.select(this).classed("fixed", d.fixed = true);
    } else if (d.fixed && e.shiftKey) {
        d3.select(this).classed("fixed", d.fixed = false);
    }
    //console.log("dragend");
    //d3.select(this).on("mouseover", mouseOver).on("mouseout", mouseOut);
}

function click(d) {
    if (d3.event.defaultPrevented) {
        return;
    }

    if (_searchMode) {
        d.initialArtist = true;
        _products = new Array();
        _products.push(d);
        update();

        _searchMode = false;
    } else if (!d3.event.shiftKey) {
        console.log("click: " + d3.mouse(this));

        if (d.type == "song" && d.url && d.url.length > 0) {
            window.open(d.url);
        } else if (d.type == "album" && !d.songRequestInitiated) {
            d.songRequestInitiated = true;
            createSongsRequest(d);
        } else if (d3.mouse(this)[0] > 0) {
            if (!d.albumRequestInitiated) {
                d.albumRequestInitiated = true;
                createAlbumsRequest(d);
            }
        } else {
            if (!d.similarRequestInitiated) {
                createSimilarRequest(d);
                d.similarRequestInitiated = true;
            }
        }
    }
}

function hasRelationship(node1, node2) {
    return  listContainsId(node1.similarArtists, node2.id) ||
            listContainsId(node2.similarArtists, node1.id) ||
            listContainsId(node1.albums, node2.id) ||
            listContainsId(node2.albums, node1.id) ||
            listContainsId(node1.songs, node2.id) ||
            listContainsId(node2.songs, node1.id);
}

function executeSearch() {
    var searchText = $('searchBox').value;

    //console.log("executeSearch: " + searchText);

    if (searchText.length > 1 && searchText != _lastSearchString) {
        _searchMode = true;
        _lastSearchString = searchText;
        var urlString = ENDPOINT_PREFIX + "artist.search&artist=" + searchText + ENDPOINT_SUFFIX;
        //console.log(urlString);
        _apiClient.request(urlString, searchResultsReturned);
    }
}

function searchResultsReturned(results) {
    _products = new Array();
    update();

    var json = JSON.decode(results);

    if (json.results && json.results.artistmatches.artist && json.results.artistmatches.artist.length > 0) {
        createArtistInfoRequests(json.results.artistmatches.artist, MAX_SEARCH_RESULTS);
    }
}

function similarResultsReturned(results, sourceArtist) {
    var json = JSON.decode(results);

    if (json.similarartists && json.similarartists.artist && json.similarartists.artist.length > 0) {
        createArtistInfoRequests(json.similarartists.artist, MAX_SIMILAR_RESULTS, sourceArtist);
    }
}

function songsResultsReturned(results, sourceAlbum) {
    var json = JSON.decode(results);

    console.log("artist count before adding songs " + _products.length);

    if (json.album && json.album.tracks && json.album.tracks.track && json.album.tracks.track.length > 0) {
        console.log("got " + json.album.tracks.track.length);

        for (var i = 0; i < json.album.tracks.track.length; i++) {
            var result = json.album.tracks.track[i];
            var trimmedName = result.name.length > 30 ? result.name.substring(0, 30) + "…" : result.name;
            var id = sourceAlbum.id + "_track_" + i;

            var song = {
                type: "song",
                "id": id,
                name: trimmedName,
                "imageUrl": "images/music_note.png",
                url: result.url,
                radius: RADIUS_SONG,
                weight: 5.0
            };

            _products.push(song);

            console.log("song: " + JSON.encode(song));

            song.x = sourceAlbum.x;
            song.y = sourceAlbum.y;
            song.px = sourceAlbum.x;
            song.py = sourceAlbum.y;

            if (!sourceAlbum.songs) {
                sourceAlbum.songs = new Array();
            }

            sourceAlbum.songs.push(song);

            update();
        }
    }

    console.log("artist count AFTER adding songs " + _products.length);
}

function albumsResultsReturned(results, sourceArtist) {
    var json = JSON.decode(results);

    if (json.topalbums && json.topalbums.album && json.topalbums.album.length > 0) {
        var resultCount = Math.min(MAX_ALBUM_RESULTS, json.topalbums.album.length);

        for (var i = 0; i < resultCount; i++) {
            var result = json.topalbums.album[i];

            var trimmedName = result.name.length > 30 ? result.name.substring(0, 30) + "…" : result.name;

            if (result.image && result.image.length >= 2) {
                var imageUrl = result.image[2]['#text'];

                //console.log("imageUrl: " + imageUrl);

                var album = {
                    type: "album",
                    id: result.mbid,
                    name: trimmedName,
                    "imageUrl": imageUrl,
                    radius: RADIUS_ALBUM,
                    weight: 5.0
                };

                _products.push(album);

                if (sourceArtist) {
                    console.log("sourceArtist: " + sourceArtist.name);

                    album.x = sourceArtist.x;
                    album.y = sourceArtist.y;
                    album.px = sourceArtist.x;
                    album.py = sourceArtist.y;

                    if (!sourceArtist.albums) {
                        sourceArtist.albums = new Array();
                    }

                    sourceArtist.albums.push(album);
                }

                update();
            }
        }
    }
}

function artistInfoReturned(results, sourceArtist) {
    var json = JSON.decode(results);

    var result = json.artist;

    if (result) {
        //console.log("artistInfoReturned: " + result.name);

        var trimmedName = result.name.length > 30 ? result.name.substring(0, 30) + "…" : result.name;

        if (result.image && result.image.length >= 2) {
            var imageUrl = result.image[2]['#text'];

            //console.log("imageUrl: " + imageUrl);

            var artist = {
                type: "artist",
                id: result.mbid,
                name: trimmedName,
                "imageUrl": imageUrl,
                similar: result.similar.artist,
                radius: RADIUS_ARTIST,
                weight: 5.0
            };

            _products.push(artist);

            if (sourceArtist) {
                console.log("sourceArtist: " + sourceArtist.name);

                artist.x = sourceArtist.x;
                artist.y = sourceArtist.y;
                artist.px = sourceArtist.x;
                artist.py = sourceArtist.y;

                if (!sourceArtist.similarArtists) {
                    sourceArtist.similarArtists = new Array();
                }

                sourceArtist.similarArtists.push(artist);
            }

            update();
        }
    } else {
        console.log("got junk back")
    }
}

function createArtistInfoRequests(matches, maxResults, sourceArtist) {
    var resultCount = Math.min(maxResults, matches.length);

    for (var i = 0; i < resultCount; i++) {
        var result = matches[i];

        //console.log("search result: " + result.name + ", mbid= " + result.mbid);

        if (result.mbid && result.mbid.length > 0) {
            //console.log("fetching: " + result.name + ", mbid= " + result.mbid);

            var existingArtist = listContainsId(_products, result.mbid);

            if (!existingArtist) {
                var urlString = ENDPOINT_PREFIX + "artist.getinfo&mbid=" + result.mbid + ENDPOINT_SUFFIX;
                _apiClient.request(urlString, artistInfoReturned, sourceArtist);
            } else {
                //console.log("skipping fetch of: " + result.name + ", " + result.mbid);
                if (!sourceArtist.similarArtists) {
                    sourceArtist.similarArtists = new Array();
                }
                sourceArtist.similarArtists.push(existingArtist);
            }
        }
    }
}

function createSimilarRequest(artist) {
    console.log("fetching similar to: " + artist.id);

    var urlString = ENDPOINT_PREFIX + "artist.getsimilar&mbid=" + artist.id + ENDPOINT_SUFFIX;
    //console.log("fetching similar to: " + artist.name + ", " + artist.id);
    //console.log(urlString);
    _apiClient.request(urlString, similarResultsReturned, artist);
}

function createAlbumsRequest(artist) {
    var urlString = ENDPOINT_PREFIX + "artist.getTopAlbums&mbid=" + artist.id + ENDPOINT_SUFFIX;
    //console.log("fetching albums for: " + artist.name + ", " + artist.id);
    _apiClient.request(urlString, albumsResultsReturned, artist);
}

function createSongsRequest(album) {
    var urlString = ENDPOINT_PREFIX + "album.getInfo&mbid=" + album.id + ENDPOINT_SUFFIX;
    console.log("fetching songs from: " + album.name + ", " + album.id);
    _apiClient.request(urlString, songsResultsReturned, album);
}

function collide(alpha) {
    var quadtree = d3.geom.quadtree(_products);
    return function(d) {
        var rb = 2 * nodeSize(d) + NODE_PADDING,
            nx1 = d.x - rb,
            nx2 = d.x + rb,
            ny1 = d.y - rb,
            ny2 = d.y + rb;

        quadtree.visit(function(quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== d)) {
                var x = d.x - quad.point.x,
                    y = d.y - quad.point.y,
                    l = Math.sqrt(x * x + y * y);
                if (l < rb) {
                    l = (l - rb) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }

            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
    };
}

function listContainsId(list, id) {
    if (!list) {
        return null;
    }

    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
            return list[i];
        }
    }

    return null;
}

