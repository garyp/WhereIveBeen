var global = {
    map: null,
    markers: [],
    infowindow: null
};

function lockerQuery(collection, params) {
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
                     var value;
                     switch (typeof(term[1])) {
                         case 'number':
                         case 'boolean':
                             value = term[1].toString();
                             break;
                         default:
                             value = ('"' +
                                 term[1].toString().replace(/"/g, '\\"') +
                                 '"');
                             break;
                     }
                     if (term.length > 2) {
                         value += term[2];
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
    bbox.extend(latlng);
    var marker;
    if (place.network == "glatitude") {
        var opacity = 1 / Math.log(place.via.accuracy * (Math.E/5));
        if (opacity < 0 || opacity > 1) opacity = 1;
        marker = new google.maps.Circle({
            center: latlng,
            radius: place.via.accuracy,
            fillColor: "red",
            fillOpacity: opacity,
            strokeWeight: 0
        });
    } else {
        marker = new google.maps.Marker({
            position: latlng
        });
    }
    if (place.network == "foursquare") {
        marker.setTitle(place.via.venue.name);
        if (place.via.venue.categories.length > 0) {
            var pcat = $.grep(place.via.venue.categories, function(cat) {
                return cat.primary;
            });
            var icon = (pcat.length > 0 ? pcat[0].icon : place.via.venue.categories[0].icon);
            marker.setIcon(new google.maps.MarkerImage(icon));
        }
    }
    if (place.network != "glatitude") {
        google.maps.event.addListener(marker, 'click', function() {
            global.infowindow.setContent(
                new Date(place.at).toString() + " via " + place.network);
            global.infowindow.open(global.map, marker);
        });
    }
    marker.setMap(global.map);
    global.markers.push(marker);
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
                global.map.fitBounds(bbox);
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

