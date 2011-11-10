var global = {
    map: null,
    markers: [],
    infowindow: null
};

function lockerQuery(collection, params) {
    function valueToString(value) {
         switch (typeof(value)) {
             case 'number':
             case 'boolean':
                 return value.toString();
                 break;
             default:
                 return ('"' +
                     value.toString().replace(/"/g, '\\"') +
                     '"');
                 break;
         }
    }

    var options = {};
    if (params.limit) {
        options.limit = Number(params.limit);
    }
    if (params.offset) {
        options.offset = Number(params.offset);
    }
    if (params.sort) {
        var field, direction;
        if (typeof(params.sort) == "string") {
            field = params.sort;
            direction = 1;
        } else {
            field = params.sort[0];
            direction = params.sort[1];
        }
        options.sort = '\'{"' + field + '":' + direction.toString() + '}\'';
    }
    if (params.fields && params.fields.length > 0) {
        options.fields = ('[' +
                params.fields.map(function(field) {
                    return field + ':1';
                }).join(',') +
                ']');
    }
    if (params.terms) {
        options.terms = ('[' +
                (typeof(params.terms) == "string" ?
                 params.terms :
                 params.terms.map(function(term) {
                     var value = valueToString(term[1]);
                     if (term.length > 2) {
                         value += term[2];
                     }
                     if (term.length > 3) {
                         value += valueToString(term[3]);
                     }
                     return term[0] + ':' + value;
                 }).join(',')) +
                ']');
    }
    console.log("Fetching /query/get" + collection + "?" +
            decodeURIComponent($.param(options)));
    if (arguments.length > 2) {
        return $.getJSON('/query/get' + collection, options, arguments[2]);
    } else {
        return $.getJSON('/query/get' + collection, options);
    }
}

function mapPlace(place, bbox) {
    var latlng = new google.maps.LatLng(place.lat, place.lng);
    var marker;
    if (place.stream) {
        marker = new google.maps.Circle({
            center: latlng,
            fillColor: "red",
            strokeWeight: 0
        });
    } else {
        marker = new google.maps.Marker({
            position: latlng
        });
        if (place.title) {
            marker.setTitle(place.title);
        }
        google.maps.event.addListener(marker, 'click', function() {
            var content = "";
            if (place.text) content += place.text + "<br />";
            content += new Date(place.at).toString() + " via " + place.network;
            global.infowindow.setContent(content);
            global.infowindow.open(global.map, marker);
        });
    }

    var processViaFn;
    if (place.network == "glatitude") {
        // for latitude locations, increase the transparency of the circle as
        // the position accuracy decreases so that the map isn't overwhelmed
        // with big red circles
        processViaFn = function(data) {
            var opacity = 1 / Math.log(data.accuracy * (Math.E/5));
            if (opacity < 0 || opacity > 1) opacity = 1;
            marker.setOptions({
                radius: data.accuracy,
                fillOpacity: opacity
            });
        };
    } else if (place.network == "foursquare") {
        // for 4sq checkins, have the map marker use the icon of the venue's
        // primary category
        processViaFn = function(data) {
            if (!data.venue || data.venue.categories.length < 1) return;
            var pcat = $.grep(data.venue.categories, function(cat) {
                return cat.primary;
            });
            // default to the first category if there's no primary one
            var icon = (pcat.length > 0 ? pcat[0].icon : data.venue.categories[0].icon);
            marker.setIcon(new google.maps.MarkerImage(icon));
        };
    }

    // reduce load of resizing the map for every single new marker by only
    // doing it once a second
    var throttledFitBounds = _.throttle(function() {
        global.map.fitBounds(bbox);
    }, 1000);

    // if there's no need to fetch place.via, then this will run immediately
    $.when( processViaFn ? $.getJSON(place.via).pipe(processViaFn) : {} )
        .done(function() {
            bbox.extend(latlng);
            // delay adding the marker to the map until here so that the marker
            // attributes (icon, size, etc.) don't jarringly change after it's
            // been placed on the map
            marker.setMap(global.map);
            global.markers.push(marker);
            throttledFitBounds();
        });
}

function reloadPlaces(data) {
    // be careful with the limit, some people have large datasets ;)
    lockerQuery('Place',
            {
                'terms': [ [ 'me', true ] ],
                'limit': $("#num_places").val(),
                'sort': [ 'at', -1 ]
            },
            function(data) {
                if (!data || !data.length) return;

                $("#places_fetched").text(data.length);

                // initialize the map's bounding box with the location of the
                // first result (i.e. make the box a point to start)
                var latlng = new google.maps.LatLng(data[0].lat, data[0].lng);
                var bbox = new google.maps.LatLngBounds(latlng, latlng);

                // clear out existing markers before loading new ones
                global.markers.forEach(
                    function(marker) { marker.setMap(null); });
                global.markers.length = 0;

                data.forEach(function(place) { mapPlace(place, bbox); });
            });
}

$(function() {
    $("#num_places").change(reloadPlaces);

    var latlng = new google.maps.LatLng(38.6, -98.8);
    var mapOptions = {
        zoom: 2,
        center: latlng,
        mapTypeId: google.maps.MapTypeId.TERRAIN
    };
    global.map = new google.maps.Map(document.getElementById("map"), mapOptions);
    global.infowindow = new google.maps.InfoWindow();
    reloadPlaces();
});

