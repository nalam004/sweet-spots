const apiKey = "AAPKf3c7596b921c4f4ba2b0e154a06df0cezPiZRCtAZHP5l0ClIf_nW0s-BCgd0q1drCVC0JAcduiwUv_DoOyTVY4OlkCs7Nl6";
const authentication = arcgisRest.ApiKeyManager.fromKey(apiKey);
let bounds = new mapboxgl.LngLatBounds();
const basemapEnum = "ArcGIS:Navigation";
let coordinates;
let map;
let popup;
let bakeries;
let selected;
let list = document.getElementById("bakeries");
let panel = document.getElementById("panel");
let preloader = document.getElementById('preloader');
let close = document.getElementById('close-route');

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
                selected = place.id;
                while (list.lastChild) { list.removeChild(list.lastChild); }
                listBakeries();
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
        preloader.style.display = 'none';
    }).catch((error) => { alert("There was a problem using the geocoder. See the console for details."); });
}

function listBakeries() {
    bakeries.sort((a, b) => (a.distance < b.distance ? -1 : 1));

    bakeries.forEach(bakery => {
        bounds.extend(bakery.geometry.coordinates);

        let details = document.createElement('div');
        let name = document.createElement('p');
        let address = document.createElement('p');
        let distance = document.createElement('p');

        details.className = 'details';
        name.className = 'name';
        address.className = 'address';
        distance.className = 'distance';

        name.innerHTML = bakery.properties.PlaceName;
        address.innerHTML = bakery.properties.Place_addr;
        distance.innerHTML = bakery.distance.toFixed([1]) + " miles";
        
        details.onclick = function() {showBakery(bakery)};
        details.appendChild(name); 
        if (bakery.id == selected) {
            let icon = document.createElement('img');
            icon.src = "img/cupcake.png";
            name.appendChild(icon);
        }
        details.appendChild(address);
        details.appendChild(distance);
        list.appendChild(details);

        panel.onmouseleave = function() { panel.scrollTop = 0; }
    })
    map.fitBounds(bounds, {padding: 20});
}

function showBakery(bakery) {
    let end = bakery.geometry.coordinates;
    selected = bakery.id;
    while (list.lastChild) { list.removeChild(list.lastChild); }
    listBakeries();
    updateRoute(end);
    map.setLayoutProperty('markers', 'icon-size', [ 'match', ['id'], selected, 0.08, 0.05 ]);
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
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },

        paint: {
            "line-color": "#ff69af",
            "line-opacity": 0.8,
            "line-width": 4
        }
    });
}

function updateRoute(end) {
    map.setLayoutProperty("route-line", 'visibility', 'visible');

    arcgisRest.solveRoute({
        stops: [coordinates, end],
        endpoint: "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve",
        authentication
    }).then((response) => {
        map.getSource("route").setData(response.routes.geoJson);
        
        // fit bounds when route is displayed
        let route = map.getSource("route")._data.features[0].geometry.coordinates;
        let route_bounds = new mapboxgl.LngLatBounds();
        for(let i = 0; i < route.length; i++) {
            route_bounds.extend(route[i]);
        }
        map.fitBounds(route_bounds, {padding: 20});
        
        // close route
        close.style.display = 'block';
        close.addEventListener('click', () => {
            map.setLayoutProperty("route-line", 'visibility', 'none');
            close.style.display = 'none';
            selected = 30;
            while (list.lastChild) { list.removeChild(list.lastChild); }
            listBakeries();
            map.fitBounds(bounds, {padding: 20});
            map.setLayoutProperty('markers', 'icon-size', [ 'match', ['id'], selected, 0.05, 0.05 ]);
        });

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