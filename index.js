const apiKey = "AAPKf3c7596b921c4f4ba2b0e154a06df0cezPiZRCtAZHP5l0ClIf_nW0s-BCgd0q1drCVC0JAcduiwUv_DoOyTVY4OlkCs7Nl6";
const authentication = arcgisRest.ApiKeyManager.fromKey(apiKey);
let bounds = new mapboxgl.LngLatBounds();
const basemapEnum = "ArcGIS:Navigation";
let coordinates;
let map;
let popup;
let bakeries;

if ("geolocation" in navigator) { 
    navigator.geolocation.getCurrentPosition(position => { 
        coordinates = [position.coords.longitude, position.coords.latitude];

        map = new mapboxgl.Map({
            container: "map",
            style: `https://basemaps-api.arcgis.com/arcgis/rest/services/styles/${basemapEnum}?type=style&token=${apiKey}`,
            center: coordinates,
            zoom: 13
        });

        map.once("load", () => { 
            // load marker image and user icon image
            map.loadImage('img/cupcake.png', (error, image) => {
                if (error) throw error;
                map.addImage('cupcake', image);
            })

            map.loadImage('https://cdn.emojidex.com/emoji/seal/yum%28pudding%29.png?1455290868', (error, image) => {
                if (error) throw error;
                map.addImage('user-icon', image);
            })

            // add user location to map
            map.addSource('user', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: coordinates
                        }
                    }]
                }
            });

            map.addLayer({
                id: "user-marker",
                source: "user",
                type: "symbol",
                layout: {
                    'icon-image': 'user-icon', 
                    'icon-size': 0.1
                }
            });
            
            // add places markers to map
            map.addSource("places", {
                type: "geojson",
                data: {
                    type: "FeatureCollection",
                    features: []
                },
                generateId: true
            });

            map.addLayer({
                id: "markers",
                source: "places",
                type: 'symbol',
                layout: {
                    'icon-image': 'cupcake', 
                    'icon-size':  0.05
                }
            });

            map.on("mouseenter", "markers", (e) => {
                const place = e.features[0];
                popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 20 })
                                .setHTML(`<b>${place.properties.PlaceName}</b>`)
                                .setLngLat(place.geometry.coordinates)
                                .addTo(map);
            });
            
            map.on("mouseleave", "markers", () => {
                popup.remove();
            });

            map.on("click", "markers", (e) => {
                const place = e.features[0];
                let end = place.geometry.coordinates;
                updateRoute(end);

                map.setLayoutProperty('markers', 'icon-size', [ 'match', ['id'], place.id, 0.08, 0.05 ]);
            });

            showPlaces();
            addRouteLayer();
        });
    }); 
} else { console.log("geolocation IS NOT availabe"); }

function showPlaces() {
    const category = "bakery";
    if (!category) { return; }
    
    arcgisRest.geocode({
        authentication,
        outFields: "Place_addr,PlaceName",
        
        params: {
            category,
            location: map.getCenter().toArray().join(","),
            maxLocations: 20
        }
    }).then((response) => {
        map.getSource("places").setData(response.geoJson);
        bakeries = response.geoJson.features;
        getDistance();
        listBakeries();
    }).catch((error) => { alert("There was a problem using the geocoder. See the console for details."); });
}

function listBakeries() {
    let list = document.getElementById("bakeries");
    bakeries.sort((a, b) => (a.distance < b.distance ? -1 : 1));

    bakeries.forEach(bakery => {
        bounds.extend(bakery.geometry.coordinates);

        let details = document.createElement('p');
        let distance = document.createElement('span');
        distance.innerHTML = bakery.distance.toFixed([1]) + " miles";
        details.className = 'details';
        details.onmouseover = function() {showAddress(this, bakery)};
        details.onmouseout = function() {showName(this, bakery)};
        details.onclick = function() {showBakery(this, bakery)};
        details.innerHTML = bakery.properties.PlaceName;
        details.appendChild(distance);
        list.appendChild(details);
    })

    map.fitBounds(bounds);
}

function showAddress(e, bakery) {
    e.innerHTML = bakery.properties.Place_addr;
}

function showName(e, bakery) {
    e.innerHTML = bakery.properties.PlaceName;
    let distance = document.createElement('span');
    distance.innerHTML = bakery.distance.toFixed([1]) + " miles";
    e.appendChild(distance);
}

function showBakery(e, bakery) {
    let end = bakery.geometry.coordinates;
    updateRoute(end);
    map.setLayoutProperty('markers', 'icon-size', [ 'match', ['id'], bakery.id, 0.08, 0.05 ]);
}

function addRouteLayer() {
    map.addSource("route", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });

    map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",

        paint: {
            "line-color": "#ff69af",
            "line-opacity": 0.8,
            "line-width": 4
        }
    });
}

function updateRoute(end) {
    arcgisRest.solveRoute({
        stops: [coordinates, end],
        endpoint: "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve",
        authentication
    }).then((response) => {
        map.getSource("route").setData(response.routes.geoJson);
    }).catch((error) => { alert("There was a problem using the route service. See the console for details."); });
}

function getDistance() {
    let index = 0;
    bakeries.forEach(b => {
        b.id = index;
        index++;
        b.distance = turf.distance(b.geometry.coordinates, coordinates, { units: 'miles' });
    })
}